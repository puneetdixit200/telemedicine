-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('unknown', 'low', 'moderate', 'high', 'critical');

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "triageLevel" "TriageLevel" NOT NULL DEFAULT 'unknown',
ADD COLUMN "triageScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Prescription"
ADD COLUMN "pharmacyName" TEXT,
ADD COLUMN "pharmacyContact" TEXT,
ADD COLUMN "handoffCode" TEXT;

-- Backfill handoff code for existing prescriptions
UPDATE "Prescription"
SET "handoffCode" = 'RX-' || UPPER(SPLIT_PART("appointmentId", '-', 1))
WHERE "handoffCode" IS NULL;

-- CreateIndex
CREATE INDEX "Appointment_triageLevel_idx" ON "Appointment"("triageLevel");

-- CreateIndex
CREATE INDEX "Prescription_handoffCode_idx" ON "Prescription"("handoffCode");
