import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";

// Configuration compatible Edge (utilisée par le proxy) : sans Prisma ni bcrypt.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
    authorized({ auth, request }) {
      const connecte = !!auth?.user;
      const surLogin = request.nextUrl.pathname.startsWith("/login");
      if (surLogin) return connecte ? Response.redirect(new URL("/", request.nextUrl)) : true;
      return connecte;
    },
  },
} satisfies NextAuthConfig;
