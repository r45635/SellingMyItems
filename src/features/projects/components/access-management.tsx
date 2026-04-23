"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  Mail,
  RefreshCw,
  Check,
  X,
  Trash2,
  Lock,
  Globe,
  Copy,
  Clock,
} from "lucide-react";
import {
  setProjectVisibilityAction,
  createTargetedInvitationAction,
  generateGenericCodeAction,
  revokeInvitationAction,
  approveAccessRequestAction,
  declineAccessRequestAction,
  revokeAccessGrantAction,
} from "@/features/projects/invitations-actions";

type Visibility = "public" | "invitation_only";

type InvitationRow = {
  id: string;
  code: string;
  email: string | null;
  status: "active" | "used" | "expired" | "revoked";
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type RequestRow = {
  id: string;
  userId: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  message: string | null;
  codeUsed: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  email: string;
  displayName: string | null;
};

type GrantRow = {
  id: string;
  userId: string;
  source: "targeted_invitation" | "generic_request" | "seller_manual";
  grantedAt: Date;
  email: string;
  displayName: string | null;
};

interface ManagementProps {
  projectId: string;
  visibility: Visibility;
  invitations: InvitationRow[];
  requests: RequestRow[];
  grants: GrantRow[];
  locale: string;
  labels: {
    visibilityLabel: string;
    visibilityPublic: string;
    visibilityInvitation: string;
    visibilityPublicHint: string;
    visibilityInvitationHint: string;
    toggleConfirmTitle: string;
    toggleConfirmBody: string;
    confirm: string;
    cancel: string;
    tabInvitations: string;
    tabRequests: string;
    tabGrants: string;
    tabGenericCode: string;
    createTargetedTitle: string;
    createTargetedHint: string;
    emailPlaceholder: string;
    validity: string;
    days7: string;
    days30: string;
    days90: string;
    createInvitation: string;
    genericCodeTitle: string;
    genericCodeHint: string;
    generateGeneric: string;
    regenerateGeneric: string;
    currentCode: string;
    expiresAt: string;
    pendingRequestsTitle: string;
    pendingRequestsEmpty: string;
    approve: string;
    decline: string;
    grantedTitle: string;
    grantedEmpty: string;
    revoke: string;
    revokeConfirm: string;
    invitationsList: string;
    invitationsEmpty: string;
    statusActive: string;
    statusUsed: string;
    statusExpired: string;
    statusRevoked: string;
  };
}

function formatDate(d: Date, locale: string) {
  return new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AccessManagement(props: ManagementProps) {
  const isInvitationOnly = props.visibility === "invitation_only";

  return (
    <div className="space-y-6">
      <VisibilitySection {...props} />

      {isInvitationOnly && (
        <>
          <GenericCodeSection {...props} />
          <TargetedInvitationSection {...props} />
          <PendingRequestsSection {...props} />
          <GrantedAccessesSection {...props} />
          <InvitationsHistorySection {...props} />
        </>
      )}
    </div>
  );
}

// ─── Visibility toggle ──────────────────────────────────────────────────────

function VisibilitySection({
  projectId,
  visibility,
  labels,
}: ManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const target: Visibility =
    visibility === "public" ? "invitation_only" : "public";

  function confirmToggle() {
    startTransition(async () => {
      await setProjectVisibilityAction(projectId, target);
      setDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          {visibility === "public" ? (
            <Globe className="h-5 w-5 mt-0.5 text-green-600" />
          ) : (
            <Lock className="h-5 w-5 mt-0.5 text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold">{labels.visibilityLabel}</p>
            <p className="text-sm text-muted-foreground">
              {visibility === "public"
                ? labels.visibilityPublic + " — " + labels.visibilityPublicHint
                : labels.visibilityInvitation +
                  " — " +
                  labels.visibilityInvitationHint}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={isPending}
        >
          {target === "invitation_only"
            ? labels.visibilityInvitation
            : labels.visibilityPublic}
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.toggleConfirmTitle}</DialogTitle>
            <DialogDescription>{labels.toggleConfirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              {labels.cancel}
            </Button>
            <Button onClick={confirmToggle} disabled={isPending}>
              {labels.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─── Generic code ───────────────────────────────────────────────────────────

function GenericCodeSection({
  projectId,
  invitations,
  locale,
  labels,
}: ManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [validity, setValidity] = useState<7 | 30 | 90>(30);
  const [copied, setCopied] = useState(false);

  const active = invitations.find(
    (i) => i.email === null && i.status === "active"
  );

  function submit() {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("validityDays", String(validity));
    startTransition(async () => {
      await generateGenericCodeAction(fd);
      router.refresh();
    });
  }

  function copy() {
    if (!active) return;
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{labels.genericCodeTitle}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{labels.genericCodeHint}</p>

      {active ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 flex-wrap">
          <div>
            <div className="font-mono text-lg font-bold tracking-wider">
              {active.code}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {labels.expiresAt}: {formatDate(active.expiresAt, locale)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              {copied ? "✓" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No active code.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <ValiditySelect
          value={validity}
          onChange={setValidity}
          labels={labels}
        />
        <Button onClick={submit} disabled={isPending} size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {active ? labels.regenerateGeneric : labels.generateGeneric}
        </Button>
      </div>
    </section>
  );
}

// ─── Targeted invitation form ───────────────────────────────────────────────

function TargetedInvitationSection({
  projectId,
  locale,
  labels,
}: ManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [validity, setValidity] = useState<7 | 30 | 90>(30);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(false);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("email", email);
    fd.set("validityDays", String(validity));
    fd.set("locale", locale);
    startTransition(async () => {
      const res = await createTargetedInvitationAction(fd);
      if (res?.error) setError(res.error);
      else {
        setOkMsg(true);
        setEmail("");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{labels.createTargetedTitle}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {labels.createTargetedHint}
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px] space-y-1.5">
          <Label htmlFor="invite-email" className="text-xs">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.emailPlaceholder}
            required
          />
        </div>
        <ValiditySelect
          value={validity}
          onChange={setValidity}
          labels={labels}
        />
        <Button type="submit" disabled={isPending} size="sm">
          {labels.createInvitation}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {okMsg && <p className="text-sm text-green-600">✓ Sent.</p>}
    </section>
  );
}

// ─── Pending requests ──────────────────────────────────────────────────────

function PendingRequestsSection({
  projectId,
  requests,
  locale,
  labels,
}: ManagementProps) {
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <h3 className="text-sm font-semibold">
          {labels.pendingRequestsTitle}{" "}
          <span className="text-muted-foreground">({pending.length})</span>
        </h3>
      </div>
      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {labels.pendingRequestsEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <RequestItem
              key={r.id}
              request={r}
              projectId={projectId}
              locale={locale}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestItem({
  request,
  projectId,
  locale,
  labels,
}: {
  request: RequestRow;
  projectId: string;
  locale: string;
  labels: ManagementProps["labels"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border p-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {request.displayName ?? request.email}
        </p>
        <p className="text-xs text-muted-foreground truncate">{request.email}</p>
        {request.message && (
          <p className="text-xs italic text-muted-foreground mt-1">
            “{request.message}”
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(request.createdAt, locale)}
          {request.codeUsed && ` · ${request.codeUsed}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await declineAccessRequestAction(request.id, projectId, locale);
              router.refresh();
            });
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {labels.decline}
        </Button>
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await approveAccessRequestAction(request.id, projectId, locale);
              router.refresh();
            });
          }}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {labels.approve}
        </Button>
      </div>
    </li>
  );
}

// ─── Granted accesses ──────────────────────────────────────────────────────

function GrantedAccessesSection({
  projectId,
  grants,
  locale,
  labels,
}: ManagementProps) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">
        {labels.grantedTitle}{" "}
        <span className="text-muted-foreground">({grants.length})</span>
      </h3>
      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {labels.grantedEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => (
            <GrantItem
              key={g.id}
              grant={g}
              projectId={projectId}
              locale={locale}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GrantItem({
  grant,
  projectId,
  locale,
  labels,
}: {
  grant: GrantRow;
  projectId: string;
  locale: string;
  labels: ManagementProps["labels"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {grant.displayName ?? grant.email}
        </p>
        <p className="text-xs text-muted-foreground truncate">{grant.email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {grant.source === "targeted_invitation"
            ? "Targeted"
            : grant.source === "generic_request"
              ? "Generic"
              : "Manual"}{" "}
          · {formatDate(grant.grantedAt, locale)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(labels.revokeConfirm)) return;
          startTransition(async () => {
            await revokeAccessGrantAction(grant.id, projectId, locale);
            router.refresh();
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        {labels.revoke}
      </Button>
    </li>
  );
}

// ─── Invitations history ───────────────────────────────────────────────────

function InvitationsHistorySection({
  projectId,
  invitations,
  locale,
  labels,
}: ManagementProps) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">
        {labels.invitationsList}{" "}
        <span className="text-muted-foreground">({invitations.length})</span>
      </h3>
      {invitations.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {labels.invitationsEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {invitations.map((inv) => (
            <InvitationItem
              key={inv.id}
              invitation={inv}
              projectId={projectId}
              locale={locale}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationItem({
  invitation,
  projectId,
  locale,
  labels,
}: {
  invitation: InvitationRow;
  projectId: string;
  locale: string;
  labels: ManagementProps["labels"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const statusColor =
    invitation.status === "active"
      ? "bg-green-50 text-green-700 border-green-200"
      : invitation.status === "used"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-muted text-muted-foreground";

  const statusLabel = {
    active: labels.statusActive,
    used: labels.statusUsed,
    expired: labels.statusExpired,
    revoked: labels.statusRevoked,
  }[invitation.status];

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono font-semibold">
            {invitation.code}
          </code>
          <Badge variant="outline" className={`text-xs ${statusColor}`}>
            {statusLabel}
          </Badge>
          {invitation.email ? (
            <span className="text-xs text-muted-foreground truncate">
              → {invitation.email}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              (generic)
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {labels.expiresAt}: {formatDate(invitation.expiresAt, locale)}
        </p>
      </div>
      {invitation.status === "active" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await revokeInvitationAction(invitation.id, projectId);
              router.refresh();
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

// ─── Validity select (shared) ───────────────────────────────────────────────

function ValiditySelect({
  value,
  onChange,
  labels,
}: {
  value: 7 | 30 | 90;
  onChange: (v: 7 | 30 | 90) => void;
  labels: ManagementProps["labels"];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{labels.validity}</Label>
      <div className="flex gap-1">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`text-xs font-medium rounded-md px-2.5 h-9 border ${
              value === d
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {d === 7 ? labels.days7 : d === 30 ? labels.days30 : labels.days90}
          </button>
        ))}
      </div>
    </div>
  );
}
