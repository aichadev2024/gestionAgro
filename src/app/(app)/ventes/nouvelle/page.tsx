import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { Caisse } from "@/components/caisse";
import { listerDepots } from "@/server/services/stocks";
import { listerClients, produitsPourCaisse } from "@/server/services/ventes";

export default async function PageNouvelleVente() {
  const user = await exigerAccesModule("/ventes");
  const [produits, clients, depots] = await Promise.all([
    produitsPourCaisse(),
    listerClients(),
    listerDepots(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/ventes" className="text-sm text-gray-500 hover:underline">
          ← Ventes
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand">Caisse</h1>
      </div>
      <Caisse
        produits={produits}
        depots={depots.map((d) => ({ id: d.id, nom: d.nom }))}
        clients={clients.map((c) => ({
          id: c.id,
          nom: c.nom,
          solde: c.solde,
          plafondCredit: c.plafondCredit,
        }))}
        peutRemise={user.role === "ADMIN" || user.role === "GERANT"}
      />
    </div>
  );
}
