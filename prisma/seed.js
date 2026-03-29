const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function upsertUser({ email, password, role, fullName, phone, doctorProfile, patientProfile }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      phone,
      role,
      passwordHash,
      doctorProfile: doctorProfile
        ? {
            upsert: {
              create: doctorProfile,
              update: doctorProfile
            }
          }
        : undefined,
      patientProfile: patientProfile
        ? {
            upsert: {
              create: patientProfile,
              update: patientProfile
            }
          }
        : undefined
    },
    create: {
      email,
      passwordHash,
      role,
      fullName,
      phone,
      doctorProfile: doctorProfile ? { create: doctorProfile } : undefined,
      patientProfile: patientProfile ? { create: patientProfile } : undefined
    }
  });
}

async function main() {
  await upsertUser({
    email: 'patient1@example.com',
    password: 'Password123!',
    role: 'patient',
    fullName: 'Patient One',
    phone: '9999999991',
    patientProfile: { chronicConditions: 'Hypertension', basicHealthInfo: 'N/A' }
  });

  await upsertUser({
    email: 'patient2@example.com',
    password: 'Password123!',
    role: 'patient',
    fullName: 'Patient Two',
    phone: '9999999992',
    patientProfile: { chronicConditions: 'Diabetes', basicHealthInfo: 'N/A' }
  });

  await upsertUser({
    email: 'doctor1@example.com',
    password: 'Password123!',
    role: 'doctor',
    fullName: 'Dr. Asha Kumar',
    phone: '8888888881',
    doctorProfile: {
      specialization: 'General Medicine',
      yearsOfExperience: 8,
      qualifications: 'MBBS',
      clinicName: 'Rural Care Clinic',
      consultationLanguages: 'English,Hindi',
      description: 'General physician.',
      callEnabled: true
    }
  });

  await upsertUser({
    email: 'doctor2@example.com',
    password: 'Password123!',
    role: 'doctor',
    fullName: 'Dr. Ravi Singh',
    phone: '8888888882',
    doctorProfile: {
      specialization: 'Dermatology',
      yearsOfExperience: 5,
      qualifications: 'MD',
      clinicName: 'Skin Health',
      consultationLanguages: 'English',
      description: 'Dermatologist.',
      callEnabled: true
    }
  });

  await upsertUser({
    email: 'admin@example.com',
    password: 'Password123!',
    role: 'admin',
    fullName: 'Admin User',
    phone: '7777777777'
  });

  await upsertUser({
    email: 'helper1@example.com',
    password: 'Password123!',
    role: 'help_worker',
    fullName: 'Community Help Worker',
    phone: '9999990001'
  });

  // Create a few default slots for doctors (next day 9:00-11:00 UTC)
  const doctors = await prisma.user.findMany({ where: { role: 'doctor' } });
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setUTCHours(9, 0, 0, 0);

  for (const doctor of doctors) {
    for (let i = 0; i < 8; i++) {
      const startAt = new Date(tomorrow.getTime() + i * 15 * 60 * 1000);
      await prisma.slot.upsert({
        where: { doctorId_startAt: { doctorId: doctor.id, startAt } },
        update: { status: 'available' },
        create: { doctorId: doctor.id, startAt, status: 'available' }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.log('Seed complete');
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
