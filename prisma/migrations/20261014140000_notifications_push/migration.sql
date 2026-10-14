-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dernierPushLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AbonnementPush" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonnementPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbonnementPush_endpoint_key" ON "AbonnementPush"("endpoint");

-- CreateIndex
CREATE INDEX "AbonnementPush_userId_idx" ON "AbonnementPush"("userId");

-- AddForeignKey
ALTER TABLE "AbonnementPush" ADD CONSTRAINT "AbonnementPush_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

