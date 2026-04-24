import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { MessageAvatar } from "./message-avatar";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  body: string;
  createdAt: Date | string;
  side: "me" | "them";
  senderName: string;
  showAvatar?: boolean;
  showTimestamp?: boolean;
};

export function MessageBubble({
  body,
  createdAt,
  side,
  senderName,
  showAvatar = true,
  showTimestamp = true,
}: MessageBubbleProps) {
  const isMe = side === "me";
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isMe ? "flex-row-reverse" : "flex-row"
      )}
    >
      {showAvatar ? (
        <MessageAvatar name={senderName} />
      ) : (
        <div className="w-9 shrink-0" aria-hidden="true" />
      )}
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-0.5",
          isMe ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            isMe
              ? "rounded-br-md bg-emerald-500 text-white dark:bg-emerald-600"
              : "rounded-bl-md bg-muted text-foreground"
          )}
        >
          <p className="whitespace-pre-wrap break-words">{body}</p>
        </div>
        {showTimestamp && (
          <LocalizedDateTime
            value={createdAt}
            className="px-1 text-[11px] text-muted-foreground"
          />
        )}
      </div>
    </div>
  );
}
