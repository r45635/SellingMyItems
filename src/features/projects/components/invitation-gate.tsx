"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, MailPlus, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  redeemInvitationCodeAction,
  requestAccessWithoutCodeAction,
} from "@/features/projects/invitations-actions";

type RequestState = "none" | "pending" | "declined";

interface InvitationGateProps {
  projectId: string;
  projectSlug: string;
  locale: string;
  isAuthenticated: boolean;
  requestState: RequestState;
  labels: {
    lockedTitle: string;
    lockedBody: string;
    signIn: string;
    enterCode: string;
    code: string;
    redeem: string;
    orRequest: string;
    messageLabel: string;
    messagePlaceholder: string;
    requestAccess: string;
    pendingTitle: string;
    pendingBody: string;
    declinedTitle: string;
    declinedBody: string;
    grantedTitle: string;
    invalidCode: string;
    codeForAnotherUser: string;
    genericError: string;
  };
}

export function InvitationGate({
  projectId,
  projectSlug,
  locale,
  isAuthenticated,
  requestState,
  labels,
}: InvitationGateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<"granted" | "pending" | null>(null);
  const [mode, setMode] = useState<"code" | "request">("code");

  function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("code", code);
    fd.set("message", message);
    fd.set("locale", locale);
    startTransition(async () => {
      const res = await redeemInvitationCodeAction(fd);
      if (res?.error === "invalid_or_expired") {
        setError(labels.invalidCode);
      } else if (res?.error === "code_for_another_user") {
        setError(labels.codeForAnotherUser);
      } else if (res?.error) {
        setError(labels.genericError);
      } else if (res?.success && res.status === "granted") {
        setSuccess("granted");
        router.refresh();
      } else if (res?.success && res.status === "already_granted") {
        router.refresh();
      } else if (res?.success) {
        setSuccess("pending");
        router.refresh();
      }
    });
  }

  function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("message", message);
    fd.set("locale", locale);
    startTransition(async () => {
      const res = await requestAccessWithoutCodeAction(fd);
      if (res?.error) {
        setError(labels.genericError);
      } else if (res?.success) {
        setSuccess("pending");
        router.refresh();
      }
    });
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border bg-muted/30 p-8 text-center space-y-4">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="text-sm font-medium">{labels.lockedTitle}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {labels.lockedBody}
        </p>
        <a
          href={`/${locale}/login?returnTo=/project/${projectSlug}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-all hover:bg-foreground/90"
        >
          {labels.signIn}
        </a>
      </div>
    );
  }

  if (requestState === "pending" || success === "pending") {
    return (
      <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-6 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {labels.pendingTitle}
          </p>
          <p className="text-amber-800 dark:text-amber-300 mt-1">
            {labels.pendingBody}
          </p>
        </div>
      </div>
    );
  }

  if (success === "granted") {
    return (
      <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 p-6 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm font-semibold text-green-900 dark:text-green-200">
          {labels.grantedTitle}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4" />
        {labels.lockedTitle}
      </div>
      <p className="text-sm text-muted-foreground">{labels.lockedBody}</p>

      {requestState === "declined" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">{labels.declinedTitle}</p>
          <p className="text-xs mt-1 text-destructive/80">{labels.declinedBody}</p>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("code")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium border ${
            mode === "code"
              ? "bg-foreground text-background border-foreground"
              : "bg-background hover:bg-muted"
          }`}
        >
          <KeyRound className="inline h-3.5 w-3.5 mr-1" /> {labels.enterCode}
        </button>
        <button
          type="button"
          onClick={() => setMode("request")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium border ${
            mode === "request"
              ? "bg-foreground text-background border-foreground"
              : "bg-background hover:bg-muted"
          }`}
        >
          <MailPlus className="inline h-3.5 w-3.5 mr-1" /> {labels.orRequest}
        </button>
      </div>

      {mode === "code" ? (
        <form onSubmit={onRedeem} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invitation-code">{labels.code}</Label>
            <Input
              id="invitation-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="font-mono tracking-wider uppercase"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-msg">{labels.messageLabel}</Label>
            <Textarea
              id="invitation-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder={labels.messagePlaceholder}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {labels.redeem}
          </Button>
        </form>
      ) : (
        <form onSubmit={onRequest} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="request-msg">{labels.messageLabel}</Label>
            <Textarea
              id="request-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={labels.messagePlaceholder}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {labels.requestAccess}
          </Button>
        </form>
      )}
    </div>
  );
}
