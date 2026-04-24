"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { linkReservationToBuyerAction, markItemSoldAction, searchBuyersAction } from "../actions";
import { UserCheck, Search, Loader2, ShoppingBag, X } from "lucide-react";

interface LinkBuyerFormProps {
  itemId: string;
  projectId: string;
  status: string;
  reservedForEmail?: string | null;
  soldToEmail?: string | null;
}

const SEARCH_DEBOUNCE_MS = 300;

export function LinkBuyerForm({
  itemId,
  projectId,
  status,
  reservedForEmail,
  soldToEmail,
}: LinkBuyerFormProps) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; email: string; displayName: string | null }[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Debounced buyer search: runs 300ms after the user stops typing so we
  // don't fire one server action per keystroke.
  const latestQueryRef = useRef("");
  useEffect(() => {
    latestQueryRef.current = searchQuery;
    if (searchQuery.length < 2 || searchQuery === selectedEmail) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchBuyersAction(searchQuery);
        // Guard against out-of-order responses — if the user kept typing
        // while the request was in flight, drop the stale results.
        if (latestQueryRef.current === searchQuery) {
          setSearchResults(results);
        }
      } finally {
        if (latestQueryRef.current === searchQuery) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedEmail]);

  function handleSelectBuyer(email: string) {
    setSelectedEmail(email);
    setSearchQuery(email);
    setSearchResults([]);
  }

  function handleLinkBuyer() {
    if (!selectedEmail) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("projectId", projectId);
      formData.set("buyerEmail", selectedEmail);

      const result = await linkReservationToBuyerAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        setSelectedEmail("");
        setSearchQuery("");
        router.refresh();
      }
    });
  }

  function handleMarkSold() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("projectId", projectId);
      if (selectedEmail) {
        formData.set("buyerEmail", selectedEmail);
      }

      const result = await markItemSoldAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        setSelectedEmail("");
        setSearchQuery("");
        router.refresh();
      }
    });
  }

  // Show current buyer link info
  if (status === "sold" && soldToEmail) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400">
        <ShoppingBag className="h-3 w-3" />
        <span>{t("soldTo")}: {soldToEmail}</span>
      </div>
    );
  }

  if (status === "reserved" && reservedForEmail) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-red-700 dark:text-red-400">
          <UserCheck className="h-3 w-3" />
          <span>{t("reservedFor")}: {reservedForEmail}</span>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[11px] text-primary hover:underline"
          >
            {t("markAsSold")}
          </button>
        ) : (
          <div className="mt-1 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">{t("markSoldDescription")}</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleMarkSold}
                disabled={isPending}
                className="inline-flex h-6 items-center gap-1 rounded bg-green-600 px-2 text-[11px] text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
                {t("confirmSold")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex h-6 items-center rounded border px-2 text-[11px] hover:bg-muted"
              >
                {t("cancelAction")}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  if (status === "reserved" && !reservedForEmail) {
    // Reserved but no buyer linked — show search form
    return (
      <div className="space-y-1">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[11px] text-primary hover:underline"
          >
            {t("linkBuyer")}
          </button>
        ) : (
          <div className="mt-1 space-y-1.5">
            <div className="relative">
              <div className="flex items-center gap-1">
                <div className="relative flex-1">
                  <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="email"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedEmail && e.target.value !== selectedEmail) {
                        setSelectedEmail("");
                      }
                    }}
                    placeholder={t("searchBuyerPlaceholder")}
                    className="h-6 w-full rounded border pl-6 pr-2 text-[11px]"
                  />
                  {isSearching && <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <button
                  type="button"
                  aria-label={t("cancelAction")}
                  onClick={() => { setShowForm(false); setSearchQuery(""); setSearchResults([]); setSelectedEmail(""); }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-0.5 w-full rounded-md border bg-popover shadow-md">
                  {searchResults.map((buyer) => (
                    <button
                      key={buyer.id}
                      type="button"
                      onClick={() => handleSelectBuyer(buyer.email)}
                      className="w-full text-left px-2 py-1 text-[11px] hover:bg-muted first:rounded-t-md last:rounded-b-md"
                    >
                      <span className="font-medium">{buyer.email}</span>
                      {buyer.displayName && (
                        <span className="ml-1 text-muted-foreground">({buyer.displayName})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleLinkBuyer}
                disabled={isPending || !selectedEmail}
                className="inline-flex h-6 items-center gap-1 rounded bg-primary px-2 text-[11px] text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                {t("confirmLink")}
              </button>
              <button
                type="button"
                onClick={handleMarkSold}
                disabled={isPending}
                className="inline-flex h-6 items-center gap-1 rounded bg-green-600 px-2 text-[11px] text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
                {t("markAsSold")}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return null;
}
