"use server";

import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/auth";

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const role = String(formData.get("role") ?? "purchaser") as UserRole;

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
  if (role !== "purchaser" && role !== "seller") {
    return { error: "Invalid role" };
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

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
    columns: { id: true, passwordHash: true, role: true },
  });

  if (!profile || !profile.passwordHash) {
    return { error: "invalidCredentials" };
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
