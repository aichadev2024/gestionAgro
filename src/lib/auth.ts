import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@/lib/roles";

const identifiants = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = identifiants.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.actif) return null;
        const ok = await bcrypt.compare(parsed.data.motDePasse, user.motDePasse);
        if (!ok) return null;
        return { id: user.id, name: user.nom, email: user.email, role: user.role as Role };
      },
    }),
  ],
});
