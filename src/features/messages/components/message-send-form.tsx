"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { sendMessageAction } from "../actions";
import { cn } from "@/lib/utils";

interface MessageSendFormProps {
  threadId: string;
  placeholder: string;
  sendLabel: string;
  sendCopyLabel: string;
  sentMessage?: string;
  /** Apply sticky bottom styling suitable for a full-height chat view. */
  sticky?: boolean;
}

export function MessageSendForm({
  threadId,
  placeholder,
  sendLabel,
  sendCopyLabel,
  sentMessage = "Message sent",
  sticky = false,
}: MessageSendFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("messages");

  function handleSubmit(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    startTransition(async () => {
      const result = await sendMessageAction(formData);
      if (result && "error" in result) {
        const errMessage =
          result.error === "tooManyRequests"
            ? t("errorTooManyRequests")
            : t("errorSending");
        toast.error(errMessage);
        return;
      }
      formRef.current?.reset();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      toast.success(sentMessage);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleInput(event: React.FormEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className={cn(
        "space-y-2",
        sticky &&
          "sticky bottom-0 border-t bg-background/90 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      )}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm transition-shadow focus-within:border-emerald-300 focus-within:shadow focus-within:ring-2 focus-within:ring-emerald-500/15 dark:focus-within:border-emerald-800">
        <textarea
          ref={textareaRef}
          name="body"
          placeholder={placeholder}
          required
          rows={1}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending}
          aria-label={sendLabel}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <label className="flex items-center gap-2 pl-2 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          name="sendCopy"
          className="rounded border-gray-300"
        />
        {sendCopyLabel}
      </label>
    </form>
  );
}
