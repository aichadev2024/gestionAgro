-- AlterEnum
ALTER TYPE "TypeMouvement" ADD VALUE 'RETOUR_CLIENT';

-- AlterTable
ALTER TABLE "LigneVenteLot" ADD COLUMN     "quantiteRetournee" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EncaissementClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "note" TEXT,
    "creeParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncaissementClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementAchat" (
    "id" TEXT NOT NULL,
    "achatId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "creeParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "dateDepense" TIMESTAMP(3) NOT NULL,
    "statut" "StatutPiece" NOT NULL DEFAULT 'VALIDEE',
    "creeParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motifAnnulation" TEXT,
    "annuleParId" TEXT,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retour" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "modeRemboursement" "ModePaiement" NOT NULL,
    "remisEnStock" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneRetour" (
    "id" TEXT NOT NULL,
    "retourId" TEXT NOT NULL,
    "ligneVenteId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "montant" INTEGER NOT NULL,
    "cout" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneRetour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClotureCaisse" (
    "id" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "attendu" INTEGER NOT NULL,
    "compte" INTEGER NOT NULL,
    "ecart" INTEGER NOT NULL,
    "note" TEXT,
    "creeParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClotureCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reussie" BOOLEAN NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncaissementClient_creeLe_idx" ON "EncaissementClient"("creeLe");

-- CreateIndex
CREATE INDEX "Depense_dateDepense_idx" ON "Depense"("dateDepense");

-- CreateIndex
CREATE UNIQUE INDEX "Retour_numero_key" ON "Retour"("numero");

-- CreateIndex
CREATE INDEX "Retour_creeLe_idx" ON "Retour"("creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "ClotureCaisse_jour_creeParId_key" ON "ClotureCaisse"("jour", "creeParId");

-- CreateIndex
CREATE INDEX "TentativeConnexion_email_creeLe_idx" ON "TentativeConnexion"("email", "creeLe");

-- AddForeignKey
ALTER TABLE "EncaissementClient" ADD CONSTRAINT "EncaissementClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementAchat" ADD CONSTRAINT "PaiementAchat_achatId_fkey" FOREIGN KEY ("achatId") REFERENCES "Achat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retour" ADD CONSTRAINT "Retour_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetour" ADD CONSTRAINT "LigneRetour_retourId_fkey" FOREIGN KEY ("retourId") REFERENCES "Retour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetour" ADD CONSTRAINT "LigneRetour_ligneVenteId_fkey" FOREIGN KEY ("ligneVenteId") REFERENCES "LigneVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
