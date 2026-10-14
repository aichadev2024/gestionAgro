-- AlterTable
ALTER TABLE "User" ADD COLUMN     "derniereAlerteLe" TIMESTAMP(3),
ADD COLUMN     "recoitAlertes" BOOLEAN NOT NULL DEFAULT false;

