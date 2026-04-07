-- CreateEnum
CREATE TYPE "PharmacyOrderStatus" AS ENUM ('placed', 'processing', 'ready', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('requested', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "PharmacyOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "prescriptionId" TEXT,
    "placedById" TEXT NOT NULL,
    "pharmacyName" TEXT,
    "pharmacyContact" TEXT,
    "handoffCode" TEXT,
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "status" "PharmacyOrderStatus" NOT NULL DEFAULT 'placed',
    "items" JSONB NOT NULL,

    CONSTRAINT "PharmacyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestCatalog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sampleType" TEXT,
    "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
    "turnaroundHours" INTEGER,
    "priceCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LabTestCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "orderedByDoctorId" TEXT,
    "familyMemberId" TEXT,
    "reportDocumentId" TEXT,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'requested',
    "clinicalNotes" TEXT,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrderItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "catalogTestId" TEXT,
    "testName" TEXT NOT NULL,
    "sampleType" TEXT,
    "instructions" TEXT,
    "priceCents" INTEGER,

    CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PharmacyOrder_patientId_createdAt_idx" ON "PharmacyOrder"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyOrder_appointmentId_idx" ON "PharmacyOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "PharmacyOrder_prescriptionId_idx" ON "PharmacyOrder"("prescriptionId");

-- CreateIndex
CREATE INDEX "PharmacyOrder_status_createdAt_idx" ON "PharmacyOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestCatalog_code_key" ON "LabTestCatalog"("code");

-- CreateIndex
CREATE INDEX "LabTestCatalog_isActive_category_idx" ON "LabTestCatalog"("isActive", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_reportDocumentId_key" ON "LabOrder"("reportDocumentId");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_createdAt_idx" ON "LabOrder"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "LabOrder_appointmentId_idx" ON "LabOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "LabOrder_orderedByDoctorId_idx" ON "LabOrder"("orderedByDoctorId");

-- CreateIndex
CREATE INDEX "LabOrder_familyMemberId_idx" ON "LabOrder"("familyMemberId");

-- CreateIndex
CREATE INDEX "LabOrder_status_createdAt_idx" ON "LabOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LabOrderItem_labOrderId_idx" ON "LabOrderItem"("labOrderId");

-- CreateIndex
CREATE INDEX "LabOrderItem_catalogTestId_idx" ON "LabOrderItem"("catalogTestId");

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_orderedByDoctorId_fkey" FOREIGN KEY ("orderedByDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_catalogTestId_fkey" FOREIGN KEY ("catalogTestId") REFERENCES "LabTestCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
