import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/src/lib/db";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth initialization with Prisma adapter.
 * This file runs on the Node.js runtime only (not Edge).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      // Attach the user ID from the JWT token to the session object
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
