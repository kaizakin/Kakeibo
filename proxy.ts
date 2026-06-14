import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

/**
 * Next.js 16 proxy.ts.
 * Uses the edge-safe auth config to protect /dashboard/* routes.
 *
 * Replaces the deprecated middleware.ts convention.
 */
export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*"],
};
