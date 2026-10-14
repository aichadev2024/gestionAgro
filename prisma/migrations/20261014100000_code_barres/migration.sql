-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "codeBarres" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Produit_codeBarres_key" ON "Produit"("codeBarres");

