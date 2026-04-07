-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('open', 'accepted', 'closed', 'rejected');

-- CreateEnum
CREATE TYPE "ExternalConsultChannel" AS ENUM ('sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "ExternalMessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "ChronicCarePlanStatus" AS ENUM ('active', 'paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CommunitySessionStatus" AS ENUM ('scheduled', 'live', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "SecondOpinionStatus" AS ENUM ('requested', 'accepted', 'completed', 'declined');

-- AlterTable
ALTER TABLE "PatientProfile"
  ADD COLUMN "abhaId" TEXT,
  ADD COLUMN "abhaAddress" TEXT,
  ADD COLUMN "abhaLinkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Appointment"
  ADD COLUMN "caseRootAppointmentId" TEXT,
  ADD COLUMN "referredFromAppointmentId" TEXT;

-- CreateTable
CREATE TABLE "ConsultationVital" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "recordedById" TEXT NOT NULL,
  "source" TEXT,
  "bpSystolic" INTEGER,
  "bpDiastolic" INTEGER,
  "temperatureC" DOUBLE PRECISION,
  "glucoseMgDl" DOUBLE PRECISION,
  "spo2Percent" INTEGER,
  "pulseBpm" INTEGER,
  "weightKg" DOUBLE PRECISION,
  "notes" TEXT,
  CONSTRAINT "ConsultationVital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "fromAppointmentId" TEXT NOT NULL,
  "toAppointmentId" TEXT,
  "patientId" TEXT NOT NULL,
  "familyMemberId" TEXT,
  "createdById" TEXT NOT NULL,
  "fromDoctorId" TEXT,
  "toDoctorId" TEXT,
  "targetSpecialization" TEXT,
  "reason" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'open',
  "continuitySnapshot" JSONB,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAccessToken" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "label" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  CONSTRAINT "PatientAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronicCarePlan" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "patientId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "familyMemberId" TEXT,
  "condition" TEXT NOT NULL,
  "status" "ChronicCarePlanStatus" NOT NULL DEFAULT 'active',
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextCheckInAt" TIMESTAMP(3),
  "checkInIntervalDays" INTEGER NOT NULL DEFAULT 30,
  "milestones" JSONB,
  "notes" TEXT,
  CONSTRAINT "ChronicCarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlanCheckIn" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "planId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  "vitalsSnapshot" JSONB,
  CONSTRAINT "CarePlanCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyEscalation" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "patientId" TEXT NOT NULL,
  "triggeredById" TEXT NOT NULL,
  "appointmentId" TEXT,
  "locationLat" DOUBLE PRECISION,
  "locationLng" DOUBLE PRECISION,
  "locationText" TEXT,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "medicalSummary" TEXT,
  "latestVitals" JSONB,
  "status" "EmergencyStatus" NOT NULL DEFAULT 'open',
  CONSTRAINT "EmergencyEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySession" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "doctorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "village" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "CommunitySessionStatus" NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  CONSTRAINT "CommunitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySessionParticipant" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sessionId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "familyMemberId" TEXT,
  "joinedByUserId" TEXT,
  "followUpAppointmentId" TEXT,
  "notes" TEXT,
  CONSTRAINT "CommunitySessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConsultThread" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "channel" "ExternalConsultChannel" NOT NULL DEFAULT 'whatsapp',
  "contactPhone" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  CONSTRAINT "ExternalConsultThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConsultMessage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "threadId" TEXT NOT NULL,
  "direction" "ExternalMessageDirection" NOT NULL,
  "body" TEXT NOT NULL,
  "syncedById" TEXT,
  "deliveryStatus" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ExternalConsultMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationVoiceNote" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "transcriptText" TEXT NOT NULL,
  "summaryText" TEXT,
  "audioBlobName" TEXT,
  "source" TEXT,
  CONSTRAINT "ConsultationVoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionRequest" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "patientId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "secondDoctorId" TEXT,
  "status" "SecondOpinionStatus" NOT NULL DEFAULT 'requested',
  "consentNote" TEXT,
  "consentGrantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewSummary" TEXT,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SecondOpinionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionAudit" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "SecondOpinionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_abhaId_key" ON "PatientProfile"("abhaId");

-- CreateIndex
CREATE INDEX "Appointment_caseRootAppointmentId_idx" ON "Appointment"("caseRootAppointmentId");

-- CreateIndex
CREATE INDEX "Appointment_referredFromAppointmentId_idx" ON "Appointment"("referredFromAppointmentId");

-- CreateIndex
CREATE INDEX "ConsultationVital_appointmentId_createdAt_idx" ON "ConsultationVital"("appointmentId", "createdAt");
CREATE INDEX "ConsultationVital_patientId_createdAt_idx" ON "ConsultationVital"("patientId", "createdAt");
CREATE INDEX "ConsultationVital_recordedById_createdAt_idx" ON "ConsultationVital"("recordedById", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_patientId_createdAt_idx" ON "Referral"("patientId", "createdAt");
CREATE INDEX "Referral_fromAppointmentId_createdAt_idx" ON "Referral"("fromAppointmentId", "createdAt");
CREATE INDEX "Referral_toAppointmentId_idx" ON "Referral"("toAppointmentId");
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccessToken_token_key" ON "PatientAccessToken"("token");
CREATE INDEX "PatientAccessToken_patientId_expiresAt_idx" ON "PatientAccessToken"("patientId", "expiresAt");
CREATE INDEX "PatientAccessToken_expiresAt_idx" ON "PatientAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ChronicCarePlan_patientId_status_nextCheckInAt_idx" ON "ChronicCarePlan"("patientId", "status", "nextCheckInAt");
CREATE INDEX "ChronicCarePlan_familyMemberId_idx" ON "ChronicCarePlan"("familyMemberId");

-- CreateIndex
CREATE INDEX "CarePlanCheckIn_planId_scheduledAt_idx" ON "CarePlanCheckIn"("planId", "scheduledAt");
CREATE INDEX "CarePlanCheckIn_appointmentId_idx" ON "CarePlanCheckIn"("appointmentId");

-- CreateIndex
CREATE INDEX "EmergencyEscalation_patientId_status_createdAt_idx" ON "EmergencyEscalation"("patientId", "status", "createdAt");
CREATE INDEX "EmergencyEscalation_appointmentId_idx" ON "EmergencyEscalation"("appointmentId");

-- CreateIndex
CREATE INDEX "CommunitySession_doctorId_startsAt_idx" ON "CommunitySession"("doctorId", "startsAt");
CREATE INDEX "CommunitySession_status_startsAt_idx" ON "CommunitySession"("status", "startsAt");

-- CreateIndex
CREATE INDEX "CommunitySessionParticipant_sessionId_createdAt_idx" ON "CommunitySessionParticipant"("sessionId", "createdAt");
CREATE INDEX "CommunitySessionParticipant_patientId_idx" ON "CommunitySessionParticipant"("patientId");
CREATE INDEX "CommunitySessionParticipant_familyMemberId_idx" ON "CommunitySessionParticipant"("familyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalConsultThread_appointmentId_key" ON "ExternalConsultThread"("appointmentId");
CREATE INDEX "ExternalConsultThread_patientId_lastMessageAt_idx" ON "ExternalConsultThread"("patientId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ExternalConsultMessage_threadId_createdAt_idx" ON "ExternalConsultMessage"("threadId", "createdAt");
CREATE INDEX "ExternalConsultMessage_syncedById_idx" ON "ExternalConsultMessage"("syncedById");

-- CreateIndex
CREATE INDEX "ConsultationVoiceNote_appointmentId_createdAt_idx" ON "ConsultationVoiceNote"("appointmentId", "createdAt");
CREATE INDEX "ConsultationVoiceNote_doctorId_createdAt_idx" ON "ConsultationVoiceNote"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "SecondOpinionRequest_patientId_status_createdAt_idx" ON "SecondOpinionRequest"("patientId", "status", "createdAt");
CREATE INDEX "SecondOpinionRequest_appointmentId_idx" ON "SecondOpinionRequest"("appointmentId");
CREATE INDEX "SecondOpinionRequest_secondDoctorId_idx" ON "SecondOpinionRequest"("secondDoctorId");

-- CreateIndex
CREATE INDEX "SecondOpinionAudit_requestId_createdAt_idx" ON "SecondOpinionAudit"("requestId", "createdAt");
CREATE INDEX "SecondOpinionAudit_actorId_createdAt_idx" ON "SecondOpinionAudit"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseRootAppointmentId_fkey" FOREIGN KEY ("caseRootAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_referredFromAppointmentId_fkey" FOREIGN KEY ("referredFromAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsultationVital" ADD CONSTRAINT "ConsultationVital_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationVital" ADD CONSTRAINT "ConsultationVital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationVital" ADD CONSTRAINT "ConsultationVital_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_fromAppointmentId_fkey" FOREIGN KEY ("fromAppointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_toAppointmentId_fkey" FOREIGN KEY ("toAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientAccessToken" ADD CONSTRAINT "PatientAccessToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientAccessToken" ADD CONSTRAINT "PatientAccessToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChronicCarePlan" ADD CONSTRAINT "ChronicCarePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChronicCarePlan" ADD CONSTRAINT "ChronicCarePlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChronicCarePlan" ADD CONSTRAINT "ChronicCarePlan_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarePlanCheckIn" ADD CONSTRAINT "CarePlanCheckIn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChronicCarePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarePlanCheckIn" ADD CONSTRAINT "CarePlanCheckIn_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmergencyEscalation" ADD CONSTRAINT "EmergencyEscalation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyEscalation" ADD CONSTRAINT "EmergencyEscalation_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyEscalation" ADD CONSTRAINT "EmergencyEscalation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunitySession" ADD CONSTRAINT "CommunitySession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunitySessionParticipant" ADD CONSTRAINT "CommunitySessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CommunitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunitySessionParticipant" ADD CONSTRAINT "CommunitySessionParticipant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunitySessionParticipant" ADD CONSTRAINT "CommunitySessionParticipant_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunitySessionParticipant" ADD CONSTRAINT "CommunitySessionParticipant_joinedByUserId_fkey" FOREIGN KEY ("joinedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunitySessionParticipant" ADD CONSTRAINT "CommunitySessionParticipant_followUpAppointmentId_fkey" FOREIGN KEY ("followUpAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalConsultThread" ADD CONSTRAINT "ExternalConsultThread_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalConsultThread" ADD CONSTRAINT "ExternalConsultThread_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalConsultMessage" ADD CONSTRAINT "ExternalConsultMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ExternalConsultThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalConsultMessage" ADD CONSTRAINT "ExternalConsultMessage_syncedById_fkey" FOREIGN KEY ("syncedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsultationVoiceNote" ADD CONSTRAINT "ConsultationVoiceNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationVoiceNote" ADD CONSTRAINT "ConsultationVoiceNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecondOpinionRequest" ADD CONSTRAINT "SecondOpinionRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecondOpinionRequest" ADD CONSTRAINT "SecondOpinionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecondOpinionRequest" ADD CONSTRAINT "SecondOpinionRequest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecondOpinionRequest" ADD CONSTRAINT "SecondOpinionRequest_secondDoctorId_fkey" FOREIGN KEY ("secondDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecondOpinionAudit" ADD CONSTRAINT "SecondOpinionAudit_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SecondOpinionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecondOpinionAudit" ADD CONSTRAINT "SecondOpinionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
