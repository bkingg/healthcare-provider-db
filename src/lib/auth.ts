import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * The only place this app authenticates a password — everything else
 * (getCurrentActor, every permission check) reads the resulting session's
 * `userId` and re-fetches the actual User/UserRole rows fresh from the DB,
 * rather than trusting anything else baked into the JWT. That means a role
 * change or account deactivation takes effect on an already-logged-in
 * user's very next request, not just their next login.
 *
 * JWT sessions (no adapter/session table) since there's exactly one
 * provider (Credentials) and no OAuth account linking to persist.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Same rejection path (return null → NextAuth's generic "invalid
        // credentials" error) whether the email doesn't exist, the account
        // is deactivated, or it has no password set (e.g. a service actor) —
        // never reveal which of those it was.
        if (!user || !user.isActive || !user.passwordHash) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
});
