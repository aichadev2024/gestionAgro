import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@/lib/roles";
import { compteBloque, enregistrerEchec, enregistrerSucces } from "@/server/services/connexion";

const identifiants = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

// Hash factice : on compare toujours un mot de passe, même si l'email n'existe pas,
// pour ne pas révéler par le temps de réponse quels comptes existent.
const HASH_FACTICE = bcrypt.hashSync("mot-de-passe-factice", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = identifiants.safeParse(raw);
        if (!parsed.success) return null;
        const { email, motDePasse } = parsed.data;

        if (await compteBloque(email)) return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        const ok = await bcrypt.compare(motDePasse, user?.motDePasse ?? HASH_FACTICE);
        if (!user || !user.actif || !ok) {
          await enregistrerEchec(email);
          return null;
        }
        await enregistrerSucces(email);
        return { id: user.id, name: user.nom, email: user.email, role: user.role as Role };
      },
    }),
  ],
});
