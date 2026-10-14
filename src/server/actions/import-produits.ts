"use server";

import { revalidatePath } from "next/cache";
import { exigerRole } from "@/lib/droits";
import { messageErreur } from "@/lib/erreurs";
import { importerProduits, MAX_OCTETS, type RapportImport } from "@/server/services/import-produits";

export type EtatImport = (Partial<RapportImport> & { erreur?: string }) | undefined;

export async function importerProduitsAction(_: EtatImport, fd: FormData): Promise<EtatImport> {
  try {
    // L'import fixe des prix : gérant et administrateur seulement.
    const user = await exigerRole("ADMIN", "GERANT");
    const fichier = fd.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez un fichier." };
    if (fichier.size > MAX_OCTETS) return { erreur: "Fichier trop volumineux (2 Mo maximum)." };

    const rapport = await importerProduits(user.id, fichier.name, Buffer.from(await fichier.arrayBuffer()));
    revalidatePath("/catalogue");
    return rapport;
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}
