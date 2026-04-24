import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  emailLogs,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  aliasEmail,
  formatSenderName,
  getOrCreateThreadAlias,
  getRelayDomain,
  isRelayEnabled,
  resolveAlias,
} from "@/lib/relay";
import { sendMessageNotificationEmail } from "@/lib/email";
import { siteConfig } from "@/config";

// Cloudflare Email Workers (or any inbound provider like Postmark Inbound) POST
// a JSON body here. The worker is responsible for extracting the envelope and
// the text body, then hitting this endpoint with a shared secret so we can
// trust the payload.
//
// Expected JSON shape (tolerant — we only read what we need):
//   {
//     "to":   "t-abc123@relay.toprecipes.best" | ["t-abc123@..."],
//     "from": "someone@example.com",        // informational only
//     "subject": "Re: ...",                 // informational only
//     "text": "message body — may include quoted reply"
//   }

type InboundPayload = {
  to?: string | string[];
  from?: string;
  subject?: string;
  text?: string;
  body?: string; // alias accepted
};

export async function POST(req: NextRequest) {
  // 1. Verify shared secret.
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("INBOUND_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Feature flag.
  if (!(await isRelayEnabled())) {
    return NextResponse.json({ error: "relay_disabled" }, { status: 503 });
  }

  // 3. Parse payload.
  let payload: InboundPayload;
  try {
    payload = (await req.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawTo = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  const body = (payload.text ?? payload.body ?? "").toString();
  if (!rawTo || !body.trim()) {
    return NextResponse.json({ error: "missing_to_or_body" }, { status: 400 });
  }

  // 4. Extract the local part and match our relay domain.
  const relayDomain = await getRelayDomain();
  if (!relayDomain) {
    return NextResponse.json({ error: "relay_domain_unset" }, { status: 503 });
  }
  const { localPart, domain } = parseAddress(rawTo);
  if (!localPart || domain?.toLowerCase() !== relayDomain.toLowerCase()) {
    return NextResponse.json({ error: "wrong_domain" }, { status: 400 });
  }

  // 5. Resolve the alias → recipient (the party who should receive the message
  //    in their mailbox). The sender for `conversation_messages` is the *other*
  //    party of the thread — we trust alias routing, not the MIME `From` header.
  const resolved = await resolveAlias(localPart);
  if (!resolved) {
    return NextResponse.json({ error: "unknown_alias" }, { status: 404 });
  }
  const { alias, recipient } = resolved;

  const thread = await db.query.conversationThreads.findFirst({
    where: eq(conversationThreads.id, alias.threadId),
  });
  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, thread.projectId),
    columns: { id: true, name: true, sellerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }

  // Figure out sender profile id: if this alias belongs to the seller, the
  // counterparty (who just emailed in) is the buyer, and vice versa.
  let senderProfileId: string;
  if (alias.participantRole === "seller") {
    senderProfileId = thread.buyerId;
  } else {
    const sellerAccount = await db.query.sellerAccounts.findFirst({
      where: eq(sellerAccounts.id, project.sellerId),
      columns: { userId: true },
    });
    if (!sellerAccount) {
      return NextResponse.json({ error: "seller_not_found" }, { status: 404 });
    }
    senderProfileId = sellerAccount.userId;
  }

  // 6. Strip quoted reply & trailing signatures (naive — MVP).
  const cleanedBody = stripQuotedReply(body);
  if (!cleanedBody) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  // 7. Persist the message and bump thread timestamps.
  const now = new Date();
  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: senderProfileId,
    body: cleanedBody,
  });
  await db
    .update(conversationThreads)
    .set({
      updatedAt: now,
      // The sender implicitly read up to "now" since they just wrote.
      buyerLastReadAt:
        alias.participantRole === "seller" ? thread.buyerLastReadAt : now,
      sellerLastReadAt:
        alias.participantRole === "buyer" ? thread.sellerLastReadAt : now,
    })
    .where(eq(conversationThreads.id, thread.id));

  // 8. Log the inbound for observability.
  try {
    await db.insert(emailLogs).values({
      toEmail: `${localPart}@${relayDomain}`,
      fromEmail: payload.from ?? "unknown",
      subject: payload.subject ?? "(inbound relay)",
      type: "inbound_relay",
      status: "sent",
    });
  } catch (err) {
    console.error("Failed to log inbound email:", err);
  }

  // 9. Forward a notification email to the *other* party (the one the sender
  //    was just replying to). Uses the existing outbound path so the recipient
  //    also gets a Reply-To alias.
  try {
    const counterpartyRole = alias.participantRole;
    const counterpartyProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, recipient.id),
      columns: { id: true, email: true, displayName: true },
    });
    const senderProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, senderProfileId),
      columns: { displayName: true, email: true },
    });
    if (counterpartyProfile?.email && senderProfile) {
      // We need the sender's OWN alias so the recipient's reply routes back.
      const replyAlias = await getOrCreateThreadAlias(
        thread.id,
        counterpartyRole === "seller" ? "buyer" : "seller",
        senderProfileId
      );
      const replyAddr = await aliasEmail(replyAlias.localPart);
      const threadUrl =
        counterpartyRole === "seller"
          ? `${siteConfig.url}/fr/seller/messages/${thread.id}`
          : `${siteConfig.url}/fr/messages/${thread.id}`;
      await sendMessageNotificationEmail(
        counterpartyProfile.email,
        senderProfile.displayName ?? senderProfile.email,
        project.name,
        cleanedBody,
        threadUrl,
        "fr",
        {
          replyTo: replyAddr ?? undefined,
          fromName: formatSenderName(senderProfile.displayName ?? null),
          headers: {
            "X-SMI-Thread-Id": thread.id,
            "X-SMI-Recipient-Id": counterpartyProfile.id,
          },
        }
      );
    }
  } catch (err) {
    console.error("Failed to forward inbound notification:", err);
  }

  return NextResponse.json({ ok: true });
}

function parseAddress(raw: string): { localPart: string | null; domain: string | null } {
  // Accept either "Name <local@domain>" or bare "local@domain".
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  const at = addr.indexOf("@");
  if (at < 0) return { localPart: null, domain: null };
  return { localPart: addr.slice(0, at), domain: addr.slice(at + 1) };
}

/**
 * Remove quoted reply lines and signatures so only the user's new text is
 * stored in the thread. MVP-quality — will occasionally leak quoted content;
 * tracked as a known limitation.
 */
function stripQuotedReply(raw: string): string {
  // Normalize line endings.
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const cutoffPatterns = [
    /^On .+ wrote:$/i,
    /^Le .+ a écrit :$/i,
    /^-{2,}\s*Original Message\s*-{2,}$/i,
    /^From: /i,
    /^De : /i,
    /^_{10,}$/,
  ];
  const out: string[] = [];
  for (const line of lines) {
    if (cutoffPatterns.some((re) => re.test(line.trim()))) break;
    if (line.trim().startsWith(">")) continue; // quoted line
    out.push(line);
  }
  // Trim trailing empty lines and a simple "-- \n<signature>" block.
  let body = out.join("\n").trim();
  const sigMatch = body.match(/\n-- ?\n[\s\S]*$/);
  if (sigMatch) body = body.slice(0, sigMatch.index).trim();
  return body;
}
