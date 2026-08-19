import type { DefaultSession } from "next-auth";

// Only `id` is added to the session's `user` — everything else this app
// needs (role/permissions, mustChangePassword, ...) is read fresh from the
// DB via getCurrentActor() rather than trusted from the JWT, so a role
// change or deactivation takes effect on the very next request instead of
// waiting for the session token to be reissued.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
