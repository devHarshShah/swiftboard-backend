/*
  Warnings:

  - Added the required column `style` to the `Edges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Edges" ADD COLUMN     "animated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceHandle" TEXT,
ADD COLUMN     "style" JSONB NOT NULL,
ADD COLUMN     "targetHandle" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Nodes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkFlow" ALTER COLUMN "updatedAt" DROP DEFAULT;
