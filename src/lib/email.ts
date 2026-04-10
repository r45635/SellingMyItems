import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

type EmailType =
  | "welcome"
  | "message_notification"
  | "intent_received"
  | "intent_status"
  | "password_reset";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "SellingMyItems <onboarding@resend.dev>";

// Cache for app_settings API key (avoids DB hit on every email)
let cachedApiKey: { value: string | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
};

async function getResendApiKey(): Promise<string> {
  // Check DB-stored key first (admin-managed), with 5-min cache
  if (cachedApiKey.expiresAt > Date.now() && cachedApiKey.value !== null) {
    return cachedApiKey.value;
  }

  try {
    const setting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "resend_api_key"),
    });
    if (setting && setting.value) {
      cachedApiKey = { value: setting.value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return setting.value;
    }
  } catch {
    // DB not ready or table doesn't exist yet — fall through to env var
  }

  // Fallback to env var
  const envKey = process.env.RESEND_API_KEY ?? "";
  cachedApiKey = { value: envKey, expiresAt: Date.now() + 5 * 60 * 1000 };
  return envKey;
}

/** Reset cached API key (call after admin updates the key) */
export function invalidateResendApiKeyCache() {
  cachedApiKey = { value: null, expiresAt: 0 };
}

// ─── Core send function with logging ────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: EmailType
): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    const errorMsg = "Resend API key not configured";
    console.error(errorMsg);
    await logEmail(to, subject, type, "failed", errorMsg);
    return { ok: false, error: errorMsg };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      const errorMsg = error.message || "Resend API error";
      console.error(`Failed to send ${type} email to ${to}:`, error);
      await logEmail(to, subject, type, "failed", errorMsg);
      return { ok: false, error: errorMsg };
    }

    const resendId = data?.id ?? undefined;
    await logEmail(to, subject, type, "sent", undefined, resendId);
    return { ok: true, resendId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to send ${type} email to ${to}:`, errorMsg);
    await logEmail(to, subject, type, "failed", errorMsg);
    return { ok: false, error: errorMsg };
  }
}

async function logEmail(
  toEmail: string,
  subject: string,
  type: EmailType,
  status: "sent" | "failed",
  errorMessage?: string,
  resendId?: string
) {
  try {
    await db.insert(emailLogs).values({
      toEmail,
      fromEmail: FROM_EMAIL,
      subject,
      type,
      status,
      errorMessage: errorMessage ?? null,
      resendId: resendId ?? null,
    });
  } catch (err) {
    console.error("Failed to log email:", err);
  }
}

// ─── Email wrapper for HTML layout ──────────────────────────────────────────

function emailLayout(content: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">${content}</div>`;
}

function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px;">${label}</a>`;
}

// ─── Password Reset ─────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale: string = "en"
) {
  const fr = locale === "fr";
  const subject = fr
    ? "Réinitialiser votre mot de passe — SellingMyItems"
    : "Reset your password — SellingMyItems";

  const html = emailLayout(
    fr
      ? `<h2>Réinitialisation du mot de passe</h2>
         <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau :</p>
         <p>${emailButton(resetUrl, "Réinitialiser mon mot de passe")}</p>
         <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>`
      : `<h2>Password Reset</h2>
         <p>You requested to reset your password. Click below to choose a new password:</p>
         <p>${emailButton(resetUrl, "Reset my password")}</p>
         <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
  );

  return sendEmail(to, subject, html, "password_reset");
}

// ─── Welcome Email ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  displayName: string,
  locale: string = "fr"
) {
  const fr = locale === "fr";
  const subject = fr
    ? "Bienvenue sur SellingMyItems !"
    : "Welcome to SellingMyItems!";

  const html = emailLayout(
    fr
      ? `<h2>Bienvenue, ${displayName} !</h2>
         <p>Votre compte a été créé avec succès. Vous pouvez maintenant parcourir les articles en vente, ajouter des articles à votre liste de souhaits, et contacter les vendeurs.</p>
         <p style="color: #666; font-size: 14px;">Si vous n'avez pas créé ce compte, contactez-nous.</p>`
      : `<h2>Welcome, ${displayName}!</h2>
         <p>Your account has been created successfully. You can now browse items for sale, add items to your wishlist, and contact sellers.</p>
         <p style="color: #666; font-size: 14px;">If you didn't create this account, please contact us.</p>`
  );

  return sendEmail(to, subject, html, "welcome");
}

// ─── Message Notification ───────────────────────────────────────────────────

export async function sendMessageNotificationEmail(
  to: string,
  senderName: string,
  projectName: string,
  messagePreview: string,
  threadUrl: string,
  locale: string = "fr"
) {
  const fr = locale === "fr";
  const subject = fr
    ? `Nouveau message de ${senderName} — ${projectName}`
    : `New message from ${senderName} — ${projectName}`;

  const preview = messagePreview.length > 200
    ? messagePreview.slice(0, 200) + "…"
    : messagePreview;

  const html = emailLayout(
    fr
      ? `<h2>Nouveau message</h2>
         <p><strong>${senderName}</strong> vous a envoyé un message concernant <strong>${projectName}</strong> :</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${preview}</blockquote>
         <p>${emailButton(threadUrl, "Voir la conversation")}</p>`
      : `<h2>New Message</h2>
         <p><strong>${senderName}</strong> sent you a message about <strong>${projectName}</strong>:</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${preview}</blockquote>
         <p>${emailButton(threadUrl, "View conversation")}</p>`
  );

  return sendEmail(to, subject, html, "message_notification");
}

// ─── Intent Received (sent to seller) ───────────────────────────────────────

export async function sendIntentReceivedEmail(
  to: string,
  buyerName: string,
  projectName: string,
  itemTitles: string[],
  intentUrl: string,
  locale: string = "fr"
) {
  const fr = locale === "fr";
  const subject = fr
    ? `Nouvelle demande d'achat — ${projectName}`
    : `New purchase intent — ${projectName}`;

  const itemList = itemTitles.map((t) => `<li>${t}</li>`).join("");

  const html = emailLayout(
    fr
      ? `<h2>Nouvelle demande d'achat</h2>
         <p><strong>${buyerName}</strong> souhaite acheter des articles de <strong>${projectName}</strong> :</p>
         <ul>${itemList}</ul>
         <p>${emailButton(intentUrl, "Voir la demande")}</p>`
      : `<h2>New Purchase Intent</h2>
         <p><strong>${buyerName}</strong> wants to buy items from <strong>${projectName}</strong>:</p>
         <ul>${itemList}</ul>
         <p>${emailButton(intentUrl, "View intent")}</p>`
  );

  return sendEmail(to, subject, html, "intent_received");
}

// ─── Intent Status Update (sent to buyer) ───────────────────────────────────

export async function sendIntentStatusEmail(
  to: string,
  status: "accepted" | "declined",
  projectName: string,
  locale: string = "fr"
) {
  const fr = locale === "fr";

  const statusLabel = fr
    ? status === "accepted" ? "acceptée" : "refusée"
    : status;

  const subject = fr
    ? `Votre demande a été ${statusLabel} — ${projectName}`
    : `Your intent has been ${status} — ${projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Mise à jour de votre demande</h2>
         <p>Votre demande d'achat pour <strong>${projectName}</strong> a été <strong>${statusLabel}</strong> par le vendeur.</p>
         ${status === "accepted"
           ? `<p>Le vendeur accepte votre demande. Consultez vos messages pour organiser le retrait.</p>`
           : `<p>Malheureusement, le vendeur a décliné votre demande. Vous pouvez consulter d'autres articles disponibles.</p>`
         }`
      : `<h2>Intent Status Update</h2>
         <p>Your purchase intent for <strong>${projectName}</strong> has been <strong>${status}</strong> by the seller.</p>
         ${status === "accepted"
           ? `<p>The seller accepted your request. Check your messages to arrange pickup.</p>`
           : `<p>Unfortunately, the seller declined your request. You can browse other available items.</p>`
         }`
  );

  return sendEmail(to, subject, html, "intent_status");
}
