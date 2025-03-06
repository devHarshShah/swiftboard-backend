-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "actualHours" DOUBLE PRECISION,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "estimatedHours" DOUBLE PRECISION,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TimeTracking" ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration" DOUBLE PRECISION,
ALTER COLUMN "endTime" DROP NOT NULL;
