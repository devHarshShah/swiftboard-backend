/*
  Warnings:

  - You are about to drop the column `position` on the `WorkFlow` table. All the data in the column will be lost.
  - You are about to drop the column `positionAbsolute` on the `WorkFlow` table. All the data in the column will be lost.
  - Added the required column `positionAbsoluteX` to the `WorkFlow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionAbsoluteY` to the `WorkFlow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionX` to the `WorkFlow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionY` to the `WorkFlow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkFlow" DROP COLUMN "position",
DROP COLUMN "positionAbsolute",
ADD COLUMN     "positionAbsoluteX" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "positionAbsoluteY" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "positionX" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "positionY" DOUBLE PRECISION NOT NULL;
