import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except:
    // - api routes
    // - _next (static files)
    // - _vercel
    // - static files (images, etc.)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
