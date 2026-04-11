"use client";

import { useRef, useTransition } from "react";
import { sendMessageAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MessageSendFormProps {
  threadId: string;
  placeholder: string;
  sendLabel: string;
  sendCopyLabel: string;
  sentMessage?: string;
}

export function MessageSendForm({
  threadId,
  placeholder,
  sendLabel,
  sendCopyLabel,
  sentMessage = "Message sent",
}: MessageSendFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await sendMessageAction(formData);
      formRef.current?.reset();
      toast.success(sentMessage);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <div className="flex gap-2">
        <Input
          name="body"
          type="text"
          placeholder={placeholder}
          required
          className="flex-1"
          disabled={isPending}
        />
        <Button type="submit" size="lg" disabled={isPending}>
          {sendLabel}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input type="checkbox" name="sendCopy" className="rounded border-gray-300" />
        {sendCopyLabel}
      </label>
    </form>
  );
}
