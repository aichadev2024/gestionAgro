import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|api/sante|api/cron|sw.js|_next/static|_next/image|icon.svg|apple-icon.png|icons|manifest.webmanifest|favicon.ico).*)"],
};
