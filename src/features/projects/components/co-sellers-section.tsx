"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import {
  inviteCoSellerAction,
  removeCoSellerAction,
} from "@/features/projects/co-seller-actions";

interface CoSeller {
  sellerAccountId: string;
  displayName: string | null;
  email: string;
}

interface CoSellersSectionProps {
  projectId: string;
  isOwner: boolean;
  collaborators: CoSeller[];
}

export function CoSellersSection({
  projectId,
  isOwner,
  collaborators,
}: CoSellersSectionProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await inviteCoSellerAction(projectId, email);
      if (result.error) {
        const messages: Record<string, string> = {
          user_not_found: "No account found with this email.",
          not_a_seller: "This user doesn't have a seller account.",
          already_collaborator: "This person is already a co-seller.",
          cannot_invite_self: "You can't invite yourself.",
          not_owner: "Only the project owner can invite co-sellers.",
        };
        setError(messages[result.error] ?? "Something went wrong.");
      } else {
        setSuccess(true);
        setEmail("");
      }
    });
  }

  function handleRemove(coSellerAccountId: string) {
    startTransition(async () => {
      await removeCoSellerAction(projectId, coSellerAccountId);
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Co-sellers</h2>
      <p className="text-xs text-muted-foreground">
        Co-sellers can manage items and respond to buyers, but cannot delete the
        project or invite others.
      </p>

      {collaborators.length > 0 ? (
        <ul className="space-y-1.5">
          {collaborators.map((c) => (
            <li
              key={c.sellerAccountId}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.displayName ?? c.email}
                </p>
                {c.displayName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {c.email}
                  </p>
                )}
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemove(c.sellerAccountId)}
                  disabled={isPending}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remove co-seller"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No co-sellers yet.
        </p>
      )}

      {isOwner && (
        <form onSubmit={handleInvite} className="flex items-center gap-2 pt-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
          />
          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && (
        <p className="text-xs text-emerald-600">Co-seller invited successfully.</p>
      )}
    </div>
  );
}
