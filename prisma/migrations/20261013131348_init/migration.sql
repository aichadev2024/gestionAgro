-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GERANT', 'MAGASINIER', 'CAISSIER', 'RESPONSABLE_PRODUCTION');

-- CreateEnum
CREATE TYPE "StatutPiece" AS ENUM ('BROUILLON', 'VALIDEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutAchat" AS ENUM ('BROUILLON', 'COMMANDE', 'RECU_PARTIEL', 'RECU', 'ANNULE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'CREDIT');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('RECEPTION', 'VENTE', 'ANNULATION_VENTE', 'PERTE', 'TRANSFERT_ENTREE', 'TRANSFERT_SORTIE', 'INVENTAIRE', 'PRODUCTION_ENTREE', 'PRODUCTION_SORTIE', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depot" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,

    CONSTRAINT "Depot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "symbole" TEXT NOT NULL,

    CONSTRAINT "Unite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "prixAchat" INTEGER NOT NULL DEFAULT 0,
    "prixVente" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "perissable" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conditionnement" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "prixVente" INTEGER,

    CONSTRAINT "Conditionnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "plafondCredit" INTEGER NOT NULL DEFAULT 0,
    "solde" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achat" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "statut" "StatutAchat" NOT NULL DEFAULT 'BROUILLON',
    "total" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motifAnnulation" TEXT,

    CONSTRAINT "Achat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneAchat" (
    "id" TEXT NOT NULL,
    "achatId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "quantiteRecue" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "prixUnitaire" INTEGER NOT NULL,

    CONSTRAINT "LigneAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "depotId" TEXT NOT NULL,
    "numeroLot" TEXT NOT NULL,
    "datePeremption" TIMESTAMP(3),
    "quantiteInitiale" DECIMAL(14,3) NOT NULL,
    "quantiteRestante" DECIMAL(14,3) NOT NULL,
    "prixAchat" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "reference" TEXT,
    "motif" TEXT,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT,
    "caissierId" TEXT NOT NULL,
    "statut" "StatutPiece" NOT NULL DEFAULT 'VALIDEE',
    "total" INTEGER NOT NULL,
    "remise" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motifAnnulation" TEXT,
    "annuleeParId" TEXT,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,
    "prixUnitaire" INTEGER NOT NULL,
    "remise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVenteLot" (
    "id" TEXT NOT NULL,
    "ligneVenteId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "LigneVenteLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "montant" INTEGER NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "cle" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "JournalAction" (
    "id" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "detail" JSONB,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Depot_nom_key" ON "Depot"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Categorie_nom_key" ON "Categorie"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Unite_nom_key" ON "Unite"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_code_key" ON "Produit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Achat_numero_key" ON "Achat"("numero");

-- CreateIndex
CREATE INDEX "Lot_produitId_depotId_datePeremption_idx" ON "Lot"("produitId", "depotId", "datePeremption");

-- CreateIndex
CREATE UNIQUE INDEX "Vente_numero_key" ON "Vente"("numero");

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conditionnement" ADD CONSTRAINT "Conditionnement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achat" ADD CONSTRAINT "Achat_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneAchat" ADD CONSTRAINT "LigneAchat_achatId_fkey" FOREIGN KEY ("achatId") REFERENCES "Achat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneAchat" ADD CONSTRAINT "LigneAchat_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_caissierId_fkey" FOREIGN KEY ("caissierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVenteLot" ADD CONSTRAINT "LigneVenteLot_ligneVenteId_fkey" FOREIGN KEY ("ligneVenteId") REFERENCES "LigneVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVenteLot" ADD CONSTRAINT "LigneVenteLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAction" ADD CONSTRAINT "JournalAction_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
