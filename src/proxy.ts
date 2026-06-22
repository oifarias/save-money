import { auth } from "@/lib/auth";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookieValue } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha"];

// Rotas acessíveis sem login que NÃO devem redirecionar quem já está logado pra fora
// (ex.: o dono do link de divisão, ou um amigo logado, também precisam conseguir ver).
const ALWAYS_ACCESSIBLE_PATHS = ["/dividir"];

export default auth((req) => {
  const { nextUrl } = req;

  // /admin é um plano de identidade totalmente separado do login de usuário comum
  // (credencial própria, cookie próprio) — não passa pelas checagens de NextAuth abaixo.
  if (nextUrl.pathname.startsWith("/admin")) {
    if (nextUrl.pathname === "/admin/login") {
      return NextResponse.next();
    }

    const cookieValue = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!verifyAdminSessionCookieValue(cookieValue)) {
      return NextResponse.redirect(new URL("/admin/login", nextUrl.origin));
    }

    return NextResponse.next();
  }

  const isLoggedIn = Boolean(req.auth);
  const isPublicPath = PUBLIC_PATHS.some((path) => nextUrl.pathname.startsWith(path));
  const isAlwaysAccessible = ALWAYS_ACCESSIBLE_PATHS.some((path) => nextUrl.pathname.startsWith(path));

  if (!isLoggedIn && !isPublicPath && !isAlwaysAccessible && nextUrl.pathname !== "/") {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
