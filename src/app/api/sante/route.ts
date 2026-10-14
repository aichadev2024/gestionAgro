import { prisma } from "@/lib/prisma";

// Contrôle de santé pour Coolify : répond 200 seulement si la base de données est joignable.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
