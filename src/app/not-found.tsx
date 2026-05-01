import Link from "next/link";
import "./globals.css";

// Root not-found: handles URLs that don't match any route at all
// (before locale routing kicks in). Cannot use next-intl here.
export default function RootNotFound() {
  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 text-center font-sans">
        <h1 className="text-6xl font-bold text-gray-400">404</h1>
        <p className="text-gray-500">This page could not be found.</p>
        <Link
          href="/"
          className="px-5 py-2 border border-gray-300 rounded-md no-underline text-inherit hover:bg-gray-50"
        >
          Go home
        </Link>
      </body>
    </html>
  );
}
