"use server";

import { db } from "@/db";
import { profiles, sessions, sellerAccounts, passwordResetTokens } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { UserRole } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { siteConfig } from "@/config";

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function getClientIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return realIp || "unknown";
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  // Seller registration is disabled for now — force purchaser role
  const role: UserRole = "purchaser";

  // Validate
  if (!email || !password) {
    return { error: "Email and password are required" };
  }
  if (password.length < 6) {
    return { error: "passwordTooShort" };
  }
  if (password !== confirmPassword) {
    return { error: "passwordMismatch" };
  }

  const clientIp = await getClientIp();
  const ipCheck = consumeRateLimit(`auth:signup:ip:${clientIp}`, {
    windowMs: 10 * 60 * 1000,
    max: 10,
  });
  if (!ipCheck.ok) {
    return { error: "tooManyRequests" };
  }

  const emailCheck = consumeRateLimit(`auth:signup:email:${email}`, {
    windowMs: 10 * 60 * 1000,
    max: 5,
  });
  if (!emailCheck.ok) {
    return { error: "tooManyRequests" };
  }

  // Check existing
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
    columns: { id: true },
  });
  if (existing) {
    return { error: "emailTaken" };
  }

  // Hash password and create profile
  const passwordHash = await bcrypt.hash(password, 12);
  const [newProfile] = await db
    .insert(profiles)
    .values({
      email,
      passwordHash,
      role,
      displayName: email.split("@")[0],
    })
    .returning({ id: profiles.id });

  // Seller registration is disabled — no seller account auto-creation

  // Send welcome email (non-blocking)
  try {
    await sendWelcomeEmail(email, email.split("@")[0], "fr");
  } catch {
    // Email failure should not block signup
  }

  // Create session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await db.insert(sessions).values({
    userId: newProfile.id,
    token,
    expiresAt,
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return { ok: true, role };
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const clientIp = await getClientIp();
  const ipCheck = consumeRateLimit(`auth:signin:ip:${clientIp}`, {
    windowMs: 10 * 60 * 1000,
    max: 20,
  });
  if (!ipCheck.ok) {
    return { error: "tooManyRequests" };
  }

  const emailCheck = consumeRateLimit(`auth:signin:email:${email}`, {
    windowMs: 10 * 60 * 1000,
    max: 8,
  });
  if (!emailCheck.ok) {
    return { error: "tooManyRequests" };
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
    columns: { id: true, passwordHash: true, role: true, isActive: true },
  });

  if (!profile || !profile.passwordHash) {
    return { error: "invalidCredentials" };
  }

  if (!profile.isActive) {
    return { error: "accountDisabled" };
  }

  const valid = await bcrypt.compare(password, profile.passwordHash);
  if (!valid) {
    return { error: "invalidCredentials" };
  }

  // Create session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await db.insert(sessions).values({
    userId: profile.id,
    token,
    expiresAt,
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return { ok: true, role: profile.role };
}

export async function signOutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return { ok: true };
}

const RESET_TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hour

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Email is required" };
  }

  const clientIp = await getClientIp();
  const ipCheck = consumeRateLimit(`auth:forgot:ip:${clientIp}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });
  if (!ipCheck.ok) {
    return { error: "tooManyRequests" };
  }

  const emailCheck = consumeRateLimit(`auth:forgot:email:${email}`, {
    windowMs: 15 * 60 * 1000,
    max: 3,
  });
  if (!emailCheck.ok) {
    return { error: "tooManyRequests" };
  }

  // Always return success to prevent email enumeration
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.email, email), eq(profiles.isActive, true)),
    columns: { id: true, email: true },
  });

  if (profile) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MAX_AGE);

    await db.insert(passwordResetTokens).values({
      userId: profile.id,
      token,
      expiresAt,
    });

    const locale = formData.get("locale")?.toString() ?? "en";
    const resetUrl = `${siteConfig.url}/${locale}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(profile.email, resetUrl, locale);
    } catch {
      console.error("Failed to send password reset email to", email);
    }
  }

  return { ok: true };
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "invalidToken" };
  }

  if (!password || password.length < 6) {
    return { error: "passwordTooShort" };
  }

  if (password !== confirmPassword) {
    return { error: "passwordMismatch" };
  }

  const clientIp = await getClientIp();
  const ipCheck = consumeRateLimit(`auth:reset:ip:${clientIp}`, {
    windowMs: 15 * 60 * 1000,
    max: 10,
  });
  if (!ipCheck.ok) {
    return { error: "tooManyRequests" };
  }

  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expiresAt, new Date()),
      isNull(passwordResetTokens.usedAt)
    ),
  });

  if (!resetToken) {
    return { error: "invalidToken" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(profiles)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(profiles.id, resetToken.userId));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetToken.id));

  return { ok: true };
}
