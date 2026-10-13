import bcrypt from "bcryptjs";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { ROLES, type Role } from "@/lib/roles";

const MIN_MDP = 8;

export function listerUtilisateurs() {
  return prisma.user.findMany({
    orderBy: [{ actif: "desc" }, { nom: "asc" }],
    select: { id: true, nom: true, email: true, role: true, actif: true, creeLe: true },
  });
}

export function derniersJournaux() {
  return prisma.journalAction.findMany({
    orderBy: { creeLe: "desc" },
    take: 50,
    include: { auteur: { select: { nom: true } } },
  });
}

function verifierMotDePasse(mdp: string) {
  if (mdp.length < MIN_MDP) {
    throw new ErreurMetier(`Le mot de passe doit contenir au moins ${MIN_MDP} caractères.`);
  }
}

async function adminsActifs(excluId?: string) {
  return prisma.user.count({
    where: { role: "ADMIN", actif: true, ...(excluId ? { id: { not: excluId } } : {}) },
  });
}

export async function creerUtilisateur(
  auteurId: string,
  d: { nom: string; email: string; role: Role; motDePasse: string },
) {
  verifierMotDePasse(d.motDePasse);
  const hash = await bcrypt.hash(d.motDePasse, 10);
  const user = await prisma.user.create({
    data: { nom: d.nom, email: d.email.toLowerCase(), role: d.role, motDePasse: hash },
  });
  await prisma.journalAction.create({
    data: {
      auteurId,
      action: "CREATION_UTILISATEUR",
      entite: "User",
      entiteId: user.id,
      detail: { email: user.email, role: user.role },
    },
  });
}

export async function changerRole(auteurId: string, id: string, role: Role) {
  if (!ROLES.includes(role)) throw new ErreurMetier("Rôle inconnu.");
  const cible = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (cible.id === auteurId) throw new ErreurMetier("Vous ne pouvez pas changer votre propre rôle.");
  if (cible.role === "ADMIN" && role !== "ADMIN" && (await adminsActifs(id)) === 0) {
    throw new ErreurMetier("Il doit rester au moins un administrateur actif.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { role } }),
    prisma.journalAction.create({
      data: {
        auteurId,
        action: "CHANGEMENT_ROLE",
        entite: "User",
        entiteId: id,
        detail: { email: cible.email, avant: cible.role, apres: role },
      },
    }),
  ]);
}

export async function basculerActif(auteurId: string, id: string) {
  const cible = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (cible.id === auteurId) throw new ErreurMetier("Vous ne pouvez pas désactiver votre propre compte.");
  if (cible.actif && cible.role === "ADMIN" && (await adminsActifs(id)) === 0) {
    throw new ErreurMetier("Il doit rester au moins un administrateur actif.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { actif: !cible.actif } }),
    prisma.journalAction.create({
      data: {
        auteurId,
        action: cible.actif ? "DESACTIVATION_UTILISATEUR" : "REACTIVATION_UTILISATEUR",
        entite: "User",
        entiteId: id,
        detail: { email: cible.email },
      },
    }),
  ]);
}

export async function reinitialiserMotDePasse(auteurId: string, id: string, motDePasse: string) {
  verifierMotDePasse(motDePasse);
  const cible = await prisma.user.findUniqueOrThrow({ where: { id } });
  const hash = await bcrypt.hash(motDePasse, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { motDePasse: hash } }),
    prisma.journalAction.create({
      data: {
        auteurId,
        action: "REINITIALISATION_MOT_DE_PASSE",
        entite: "User",
        entiteId: id,
        detail: { email: cible.email },
      },
    }),
  ]);
}
