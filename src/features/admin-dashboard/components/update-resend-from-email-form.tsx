"use client";

import { useState } from "react";
import { updateResendFromEmailAction } from "@/features/admin-dashboard/actions";

export function UpdateResendFromEmailForm() {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);

    const result = await updateResendFromEmailAction(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "From email updated successfully" });
    }
    setPending(false);
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          name="fromEmail"
          placeholder="SellingMyItems <noreply@yourdomain.com>"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {pending ? "Updating..." : "Update Sender"}
        </button>
      </div>
      {message && (
        <p
          className={`text-xs ${
            message.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
