"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import "./globals.css";

// global-error.tsx wraps the root layout itself, so it cannot use
// next-intl or any provider that depends on the locale layout tree.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 text-center font-sans">
        <AlertTriangle className="h-12 w-12 text-red-600" />
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        {error.digest && (
          <p className="text-xs text-gray-500 font-mono">{error.digest}</p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="px-4 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
