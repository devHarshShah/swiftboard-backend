/*
  Warnings:

  - You are about to drop the column `data` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `dragging` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `positionAbsoluteX` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `positionAbsoluteY` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `selected` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `WorkFlow` table. All the data in the column will be lost.
  - Added the required column `name` to the `WorkFlow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkFlow" DROP COLUMN "data",
DROP COLUMN "dragging",
DROP COLUMN "height",
DROP COLUMN "positionAbsoluteX",
DROP COLUMN "positionAbsoluteY",
DROP COLUMN "positionX",
DROP COLUMN "positionY",
DROP COLUMN "selected",
DROP COLUMN "type",
DROP COLUMN "width",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Nodes" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL,
    "positionAbsoluteX" DOUBLE PRECISION NOT NULL,
    "positionAbsoluteY" DOUBLE PRECISION NOT NULL,
    "dragging" BOOLEAN NOT NULL,
    "workFlowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edges" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workFlowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edges_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Nodes" ADD CONSTRAINT "Nodes_workFlowId_fkey" FOREIGN KEY ("workFlowId") REFERENCES "WorkFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edges" ADD CONSTRAINT "Edges_workFlowId_fkey" FOREIGN KEY ("workFlowId") REFERENCES "WorkFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
