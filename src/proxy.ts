import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Named `proxy.ts`, not `middleware.ts`: this Next.js version renamed the
// middleware file convention to "proxy" (see AGENTS.md — read the bundled
// Next docs before assuming training-data conventions still apply). The
// exported function must be named `proxy` (or be the default export).
//
// Proxy defaults to the Node.js runtime in this Next.js version (see
// node_modules/next/dist/docs/.../proxy.md's "Runtime" section), so calling
// auth() and prisma directly here — no Edge-safe auth.config.ts split
// needed — is fine.
const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_SEGMENTS = new Set(["login"]);

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  // A Location header means next-intl itself is redirecting (e.g. bare `/`
  // -> `/en`) — let that happen first; auth is checked on the follow-up
  // request, once the pathname actually carries a locale segment.
  if (intlResponse.headers.get("location")) return intlResponse;

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = (routing.locales as readonly string[]).includes(segments[0]) ? segments[0] : routing.defaultLocale;
  const routeSegment = segments[1];
  const isPublicRoute = routeSegment !== undefined && PUBLIC_SEGMENTS.has(routeSegment);

  // The member app (/m) has its own sign-in (src/lib/memberAuth.ts) and
  // checks it in its own layouts; staff auth doesn't apply there. Every
  // other route below stays behind the staff login, so a member session can
  // never reach a staff page.
  if (routeSegment === "m") return intlResponse;

  const session = await auth();

  if (!session?.user && !isPublicRoute) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  if (session?.user) {
    if (routeSegment === "login") {
      return NextResponse.redirect(new URL(`/${locale}/providers`, request.url));
    }
    // Checked fresh against the DB (not embedded in the JWT) so it can never
    // go stale mid-session — see src/lib/auth.ts's session-shape comment.
    if (routeSegment !== "change-password") {
      const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { mustChangePassword: true } });
      if (dbUser?.mustChangePassword) {
        return NextResponse.redirect(new URL(`/${locale}/change-password`, request.url));
      }
    }
  }

  return intlResponse;
}

export const config = {
  // Skip API routes, Next internals, and files with an extension (images,
  // favicon, etc.) — everything else gets locale-prefix + auth handling.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
