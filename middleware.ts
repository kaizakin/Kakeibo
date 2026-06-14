import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

/**
 * Next.js 16 middleware (proxy.ts).
 * Uses the edge-safe auth config to protect /dashboard/* routes.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*"],
};
