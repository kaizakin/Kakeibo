import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/src/lib/db";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth initialization with Prisma adapter.
 * This file runs on the Node.js runtime only (not Edge).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session({ session, user }) {
      // Attach the database user ID to the session object
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
