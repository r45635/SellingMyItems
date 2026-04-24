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
  | "password_reset"
  | "reservation_recap"
  | "invitation_sent"
  | "access_granted"
  | "access_declined"
  | "access_revoked"
  | "access_requested";

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

  const replyHint = fr
    ? `<p style="color:#888;font-size:12px;margin-top:20px;">Ne répondez pas à cet email — répondez directement dans l'application pour que ${senderName} reçoive votre message.</p>`
    : `<p style="color:#888;font-size:12px;margin-top:20px;">Don't reply to this email — reply inside the app so ${senderName} actually receives your message.</p>`;

  const html = emailLayout(
    (fr
      ? `<h2>Nouveau message</h2>
         <p><strong>${senderName}</strong> vous a envoyé un message concernant <strong>${projectName}</strong> :</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${preview}</blockquote>
         <p>${emailButton(threadUrl, "Répondre dans l'application")}</p>`
      : `<h2>New Message</h2>
         <p><strong>${senderName}</strong> sent you a message about <strong>${projectName}</strong>:</p>
         <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 16px 0;">${preview}</blockquote>
         <p>${emailButton(threadUrl, "Reply in the app")}</p>`) + replyHint
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

// ─── Reservation Recap (sent by seller to buyer) ────────────────────────────

export async function sendReservationRecapEmail(
  to: string,
  buyerName: string,
  sellerName: string,
  projectName: string,
  reservedItems: { title: string; price: number | null; currency: string }[],
  personalMessage: string,
  projectUrl: string,
  locale: string = "en"
) {
  const fr = locale === "fr";
  const subject = fr
    ? `Récapitulatif de vos articles réservés — ${projectName}`
    : `Your reserved items summary — ${projectName}`;

  const itemRows = reservedItems
    .map((item) => {
      const priceStr =
        item.price != null
          ? new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
              style: "currency",
              currency: item.currency,
            }).format(item.price)
          : fr
            ? "Prix non défini"
            : "Price not set";
      return `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.title}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${priceStr}</td>
      </tr>`;
    })
    .join("");

  const total = reservedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const totalCurrency = reservedItems[0]?.currency ?? "USD";
  const totalStr = new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
    style: "currency",
    currency: totalCurrency,
  }).format(total);

  const escapedMessage = personalMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const html = emailLayout(
    `${emailHeader()}
    ${fr
      ? `<h2>Récapitulatif de vos réservations</h2>
         <p>Bonjour <strong>${buyerName}</strong>,</p>
         <p><strong>${sellerName}</strong> vous envoie un récapitulatif de vos articles réservés dans le projet <strong>${projectName}</strong> :</p>
         <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
           <thead>
             <tr style="background: #f5f5f5;">
               <th style="padding: 8px 12px; text-align: left; font-size: 13px;">Article</th>
               <th style="padding: 8px 12px; text-align: right; font-size: 13px;">Prix</th>
             </tr>
           </thead>
           <tbody>${itemRows}</tbody>
           <tfoot>
             <tr>
               <td style="padding: 10px 12px; font-weight: 700;">Total</td>
               <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${totalStr}</td>
             </tr>
           </tfoot>
         </table>
         ${personalMessage.trim()
           ? `<div style="background: #f9f9f9; border-left: 3px solid #ddd; padding: 12px 16px; margin: 16px 0; color: #444;">
               <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px;">Message du vendeur :</p>
               <p style="margin: 0;">${escapedMessage}</p>
             </div>`
           : ""
         }
         <p style="text-align: center; margin: 24px 0;">${emailButton(projectUrl, "Voir le projet")}</p>
         <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
         <p style="color: #888; font-size: 13px;">— L'équipe SellingMyItems</p>`
      : `<h2>Your Reserved Items Summary</h2>
         <p>Hi <strong>${buyerName}</strong>,</p>
         <p><strong>${sellerName}</strong> is sending you a summary of your reserved items in the project <strong>${projectName}</strong>:</p>
         <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
           <thead>
             <tr style="background: #f5f5f5;">
               <th style="padding: 8px 12px; text-align: left; font-size: 13px;">Item</th>
               <th style="padding: 8px 12px; text-align: right; font-size: 13px;">Price</th>
             </tr>
           </thead>
           <tbody>${itemRows}</tbody>
           <tfoot>
             <tr>
               <td style="padding: 10px 12px; font-weight: 700;">Total</td>
               <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${totalStr}</td>
             </tr>
           </tfoot>
         </table>
         ${personalMessage.trim()
           ? `<div style="background: #f9f9f9; border-left: 3px solid #ddd; padding: 12px 16px; margin: 16px 0; color: #444;">
               <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px;">Message from seller:</p>
               <p style="margin: 0;">${escapedMessage}</p>
             </div>`
           : ""
         }
         <p style="text-align: center; margin: 24px 0;">${emailButton(projectUrl, "View project")}</p>
         <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
         <p style="color: #888; font-size: 13px;">— The SellingMyItems Team</p>`
    }`
  );

  return sendEmail(to, subject, html, "reservation_recap");
}

// ─── Invitation Sent (targeted email or generic code share) ─────────────────

export async function sendInvitationEmail(
  to: string,
  params: {
    projectName: string;
    sellerName: string;
    code: string;
    projectUrl: string;
    expiresAt: Date;
    isTargeted: boolean;
    locale?: string;
  }
) {
  const fr = params.locale === "fr";
  const expiryStr = params.expiresAt.toLocaleDateString(fr ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = fr
    ? `Invitation à rejoindre ${params.projectName}`
    : `You're invited to ${params.projectName}`;

  const codeBlock = `<div style="font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 2px; background: #f5f5f5; border: 1px dashed #bbb; padding: 14px 18px; text-align: center; border-radius: 8px; margin: 16px 0;">${params.code}</div>`;

  const html = emailLayout(
    `${emailHeader()}
    ${fr
      ? `<h2 style="margin: 0 0 8px;">Vous êtes invité(e) par ${params.sellerName}</h2>
         <p style="color: #444;">Le vendeur vous a invité(e) à accéder au projet <strong>${params.projectName}</strong> sur SellingMyItems.</p>
         ${params.isTargeted
           ? `<p style="color: #444;">Votre code d'invitation personnel :</p>${codeBlock}<p style="color: #666; font-size: 14px;">Connectez-vous (ou créez votre compte) avec cette adresse email pour obtenir l'accès automatique.</p>`
           : `<p style="color: #444;">Entrez ce code d'invitation pour demander l'accès :</p>${codeBlock}<p style="color: #666; font-size: 14px;">Votre demande sera validée par le vendeur avant accès.</p>`
         }
         <p style="text-align: center; margin: 24px 0;">${emailButton(params.projectUrl, "Voir le projet")}</p>
         <p style="color: #888; font-size: 13px;">Valide jusqu'au <strong>${expiryStr}</strong>.</p>`
      : `<h2 style="margin: 0 0 8px;">You're invited by ${params.sellerName}</h2>
         <p style="color: #444;">You've been invited to access the project <strong>${params.projectName}</strong> on SellingMyItems.</p>
         ${params.isTargeted
           ? `<p style="color: #444;">Your personal invitation code:</p>${codeBlock}<p style="color: #666; font-size: 14px;">Sign in (or sign up) with this email to get automatic access.</p>`
           : `<p style="color: #444;">Enter this invitation code to request access:</p>${codeBlock}<p style="color: #666; font-size: 14px;">Your request will be reviewed by the seller before access is granted.</p>`
         }
         <p style="text-align: center; margin: 24px 0;">${emailButton(params.projectUrl, "View project")}</p>
         <p style="color: #888; font-size: 13px;">Valid until <strong>${expiryStr}</strong>.</p>`
    }`
  );

  return sendEmail(to, subject, html, "invitation_sent");
}

// ─── Access Granted (to buyer) ──────────────────────────────────────────────

export async function sendAccessGrantedEmail(
  to: string,
  params: { projectName: string; projectUrl: string; locale?: string }
) {
  const fr = params.locale === "fr";
  const subject = fr
    ? `Accès accordé — ${params.projectName}`
    : `Access granted — ${params.projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Accès accordé</h2>
         <p>Votre accès au projet <strong>${params.projectName}</strong> a été validé.</p>
         <p>${emailButton(params.projectUrl, "Voir le projet")}</p>`
      : `<h2>Access granted</h2>
         <p>Your access to the project <strong>${params.projectName}</strong> has been approved.</p>
         <p>${emailButton(params.projectUrl, "View project")}</p>`
  );

  return sendEmail(to, subject, html, "access_granted");
}

// ─── Access Declined (to buyer) ─────────────────────────────────────────────

export async function sendAccessDeclinedEmail(
  to: string,
  params: { projectName: string; locale?: string }
) {
  const fr = params.locale === "fr";
  const subject = fr
    ? `Demande d'accès refusée — ${params.projectName}`
    : `Access request declined — ${params.projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Demande refusée</h2>
         <p>Le vendeur a décliné votre demande d'accès au projet <strong>${params.projectName}</strong>.</p>`
      : `<h2>Request declined</h2>
         <p>The seller has declined your access request for <strong>${params.projectName}</strong>.</p>`
  );

  return sendEmail(to, subject, html, "access_declined");
}

// ─── Access Revoked (to buyer) ──────────────────────────────────────────────

export async function sendAccessRevokedEmail(
  to: string,
  params: { projectName: string; locale?: string }
) {
  const fr = params.locale === "fr";
  const subject = fr
    ? `Accès retiré — ${params.projectName}`
    : `Access revoked — ${params.projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Accès retiré</h2>
         <p>Votre accès au projet <strong>${params.projectName}</strong> a été retiré par le vendeur.</p>`
      : `<h2>Access revoked</h2>
         <p>Your access to the project <strong>${params.projectName}</strong> has been revoked by the seller.</p>`
  );

  return sendEmail(to, subject, html, "access_revoked");
}

// ─── Access Requested (to seller) ───────────────────────────────────────────

export async function sendAccessRequestedEmail(
  to: string,
  params: {
    buyerName: string;
    buyerEmail: string;
    projectName: string;
    manageUrl: string;
    locale?: string;
  }
) {
  const fr = params.locale === "fr";
  const subject = fr
    ? `Nouvelle demande d'accès — ${params.projectName}`
    : `New access request — ${params.projectName}`;

  const html = emailLayout(
    fr
      ? `<h2>Nouvelle demande d'accès</h2>
         <p><strong>${params.buyerName}</strong> (${params.buyerEmail}) demande l'accès au projet <strong>${params.projectName}</strong>.</p>
         <p>${emailButton(params.manageUrl, "Gérer les accès")}</p>`
      : `<h2>New access request</h2>
         <p><strong>${params.buyerName}</strong> (${params.buyerEmail}) is requesting access to <strong>${params.projectName}</strong>.</p>
         <p>${emailButton(params.manageUrl, "Manage access")}</p>`
  );

  return sendEmail(to, subject, html, "access_requested");
}
