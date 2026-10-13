-- CreateTable
CREATE TABLE "Recette" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "produitFiniId" TEXT NOT NULL,
    "quantiteProduite" DECIMAL(14,3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneRecette" (
    "id" TEXT NOT NULL,
    "recetteId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "LigneRecette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "recetteId" TEXT NOT NULL,
    "multiplicateur" DECIMAL(14,3) NOT NULL,
    "quantiteTheorique" DECIMAL(14,3) NOT NULL,
    "quantiteObtenue" DECIMAL(14,3) NOT NULL,
    "coutTotal" INTEGER NOT NULL,
    "statut" "StatutPiece" NOT NULL DEFAULT 'VALIDEE',
    "lotId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeParId" TEXT NOT NULL,
    "motifAnnulation" TEXT,
    "annuleParId" TEXT,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsommationProduction" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantite" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ConsommationProduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recette_nom_key" ON "Recette"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Production_numero_key" ON "Production"("numero");

-- AddForeignKey
ALTER TABLE "Recette" ADD CONSTRAINT "Recette_produitFiniId_fkey" FOREIGN KEY ("produitFiniId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRecette" ADD CONSTRAINT "LigneRecette_recetteId_fkey" FOREIGN KEY ("recetteId") REFERENCES "Recette"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRecette" ADD CONSTRAINT "LigneRecette_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_recetteId_fkey" FOREIGN KEY ("recetteId") REFERENCES "Recette"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsommationProduction" ADD CONSTRAINT "ConsommationProduction_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsommationProduction" ADD CONSTRAINT "ConsommationProduction_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
