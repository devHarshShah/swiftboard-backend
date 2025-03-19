-- CreateTable
CREATE TABLE "WorkFlow" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL,
    "positionAbsolute" JSONB NOT NULL,
    "dragging" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkFlow_pkey" PRIMARY KEY ("id")
);
