import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { siteConfig } from "@/config";

type EmailType =
  | "welcome"
  | "message_notification"
  | "message_copy"
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

let cachedFromEmail: { value: string | null; expiresAt: number } = {
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

async function getResendFromEmail(): Promise<string> {
  if (cachedFromEmail.expiresAt > Date.now() && cachedFromEmail.value !== null) {
    return cachedFromEmail.value;
  }

  try {
    const setting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "resend_from_email"),
    });
    if (setting && setting.value) {
      cachedFromEmail = {
        value: setting.value,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      return setting.value;
    }
  } catch {
    // DB not ready or table doesn't exist yet — fall through to env var
  }

  cachedFromEmail = {
    value: FROM_EMAIL,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  return FROM_EMAIL;
}

/** Reset cached API key (call after admin updates the key) */
export function invalidateResendApiKeyCache() {
  cachedApiKey = { value: null, expiresAt: 0 };
}

export function invalidateResendFromEmailCache() {
  cachedFromEmail = { value: null, expiresAt: 0 };
}

// ─── Core send function with logging ────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: EmailType
): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const apiKey = await getResendApiKey();
  const fromEmail = await getResendFromEmail();
  if (!apiKey) {
    const errorMsg = "Resend API key not configured";
    console.error(errorMsg);
    await logEmail(to, fromEmail, subject, type, "failed", errorMsg);
    return { ok: false, error: errorMsg };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    if (error) {
      const errorMsg = error.message || "Resend API error";
      console.error(`Failed to send ${type} email to ${to}:`, error);
      await logEmail(to, fromEmail, subject, type, "failed", errorMsg);
      return { ok: false, error: errorMsg };
    }

    const resendId = data?.id ?? undefined;
    await logEmail(to, fromEmail, subject, type, "sent", undefined, resendId);
    return { ok: true, resendId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to send ${type} email to ${to}:`, errorMsg);
    await logEmail(to, fromEmail, subject, type, "failed", errorMsg);
    return { ok: false, error: errorMsg };
  }
}

async function logEmail(
  toEmail: string,
  fromEmail: string,
  subject: string,
  type: EmailType,
  status: "sent" | "failed",
  errorMessage?: string,
  resendId?: string
) {
  try {
    await db.insert(emailLogs).values({
      toEmail,
      fromEmail,
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

function emailLogo(): string {
  return `<div style="display: inline-block; width: 40px; height: 40px; background: #18181b; border-radius: 10px; text-align: center; line-height: 40px; vertical-align: middle;">
    <span style="color: #fff; font-weight: 800; font-size: 16px; letter-spacing: -0.5px;">SMI</span>
  </div>`;
}

function emailHeader(): string {
  return `<div style="text-align: center; padding: 24px 0 16px;">
    ${emailLogo()}
    <span style="display: inline-block; vertical-align: middle; margin-left: 12px; font-size: 20px; font-weight: 700; color: #18181b;">SellingMyItems</span>
  </div>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 0 0 24px;" />`;
}

export async function sendWelcomeEmail(
  to: string,
  displayName: string,
  locale: string = "en"
) {
  const fr = locale === "fr";
  const appUrl = siteConfig.url;
  const subject = fr
    ? "Bienvenue sur SellingMyItems ! \uD83C\uDF89"
    : "Welcome to SellingMyItems! \uD83C\uDF89";

  const html = emailLayout(
    `${emailHeader()}
    ${fr
      ? `<h2 style="margin: 0 0 8px;">Bienvenue, ${displayName} ! \uD83D\uDC4B</h2>
         <p style="color: #444; line-height: 1.6;">Votre compte a été créé avec succès. Vous êtes prêt(e) à explorer notre marketplace.</p>
         <p style="color: #444; font-weight: 600; margin-bottom: 8px;">Voici ce que vous pouvez faire :</p>
         <table style="color: #444; line-height: 1.8; margin-bottom: 20px;">
           <tr><td style="padding-right: 10px;">\uD83D\uDECD\uFE0F</td><td>Parcourir les articles en vente</td></tr>
           <tr><td style="padding-right: 10px;">\u2764\uFE0F</td><td>Sauvegarder vos favoris dans votre liste de souhaits</td></tr>
           <tr><td style="padding-right: 10px;">\uD83D\uDCAC</td><td>Contacter les vendeurs directement</td></tr>
           <tr><td style="padding-right: 10px;">\uD83D\uDCE7</td><td>Être notifié(e) des réponses des vendeurs</td></tr>
         </table>
         <p style="text-align: center; margin: 24px 0;">${emailButton(appUrl + "/fr", "Accéder à SellingMyItems →")}</p>
         <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
         <p style="color: #888; font-size: 13px;">Votre identifiant : <strong>${to}</strong></p>
         <p style="color: #888; font-size: 13px;">Lien : <a href="${appUrl}" style="color: #888;">${appUrl}</a></p>
         <p style="color: #888; font-size: 13px;">Si vous n'avez pas créé ce compte, vous pouvez ignorer cet email.</p>
         <p style="color: #888; font-size: 13px; margin-top: 16px;">— L'équipe SellingMyItems</p>`
      : `<h2 style="margin: 0 0 8px;">Welcome, ${displayName}! \uD83D\uDC4B</h2>
         <p style="color: #444; line-height: 1.6;">Your account has been created successfully. You're all set to explore our marketplace.</p>
         <p style="color: #444; font-weight: 600; margin-bottom: 8px;">Here's what you can do:</p>
         <table style="color: #444; line-height: 1.8; margin-bottom: 20px;">
           <tr><td style="padding-right: 10px;">\uD83D\uDECD\uFE0F</td><td>Browse items for sale across projects</td></tr>
           <tr><td style="padding-right: 10px;">\u2764\uFE0F</td><td>Save your favorites to your wishlist</td></tr>
           <tr><td style="padding-right: 10px;">\uD83D\uDCAC</td><td>Message sellers directly</td></tr>
           <tr><td style="padding-right: 10px;">\uD83D\uDCE7</td><td>Get notified when sellers respond</td></tr>
         </table>
         <p style="text-align: center; margin: 24px 0;">${emailButton(appUrl + "/en", "Access SellingMyItems →")}</p>
         <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
         <p style="color: #888; font-size: 13px;">Your login: <strong>${to}</strong></p>
         <p style="color: #888; font-size: 13px;">Link: <a href="${appUrl}" style="color: #888;">${appUrl}</a></p>
         <p style="color: #888; font-size: 13px;">If you didn't create this account, you can safely ignore this email.</p>
         <p style="color: #888; font-size: 13px; margin-top: 16px;">— The SellingMyItems Team</p>`
    }`
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
  locale: string = "en"
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
  locale: string = "en"
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
  locale: string = "en"
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

// ─── Message Copy (sent to the sender as a copy) ────────────────────────────

export async function sendMessageCopyEmail(
  to: string,
  recipientName: string,
  projectName: string,
  messageBody: string,
  threadUrl: string,
  locale: string = "en"
) {
  const fr = locale === "fr";
  const subject = fr
    ? `Copie de votre message — ${projectName}`
    : `Copy of your message — ${projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Copie de votre message</h2>
         <p>Vous avez envoyé un message à <strong>${recipientName}</strong> concernant <strong>${projectName}</strong> :</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${messageBody}</blockquote>
         <p>${emailButton(threadUrl, "Voir la conversation")}</p>
         <p style="color: #666; font-size: 14px;">Ceci est une copie de votre message envoyé via SellingMyItems.</p>`
      : `<h2>Copy of Your Message</h2>
         <p>You sent a message to <strong>${recipientName}</strong> about <strong>${projectName}</strong>:</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${messageBody}</blockquote>
         <p>${emailButton(threadUrl, "View conversation")}</p>
         <p style="color: #666; font-size: 14px;">This is a copy of your message sent via SellingMyItems.</p>`
  );

  return sendEmail(to, subject, html, "message_copy");
}
