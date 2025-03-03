/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `TeamMembership` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `TeamMembership` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "token" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_token_key" ON "TeamMembership"("token");
