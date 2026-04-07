const { prisma } = require('../models/db');

const TRUST_WINDOW_DAYS = 90;

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function responseScoreFromMinutes(minutes) {
  if (!Number.isFinite(minutes)) return 0.5;
  if (minutes <= 5) return 1;
  if (minutes <= 15) return 0.85;
  if (minutes <= 30) return 0.7;
  if (minutes <= 60) return 0.5;
  return 0.3;
}

function trustBand(score) {
  if (score >= 85) return 'high_trust';
  if (score >= 70) return 'trusted';
  if (score >= 50) return 'growing';
  return 'new_or_recovering';
}

function isMissingTable(error, tableName) {
  return Boolean(
    error &&
      error.code === 'P2021' &&
      String(error.meta?.table || '')
        .toLowerCase()
        .includes(String(tableName || '').toLowerCase())
  );
}

async function computeDoctorTrustScore(doctorId) {
  const since = new Date(Date.now() - TRUST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [statusRows, reviewStats, callSessions] = await Promise.all([
    prisma.appointment.groupBy({
      by: ['status'],
      where: {
        doctorId,
        startAt: { gte: since }
      },
      _count: { _all: true }
    }),
    prisma.doctorReview
      .aggregate({
        where: {
          doctorId,
          createdAt: { gte: since }
        },
        _avg: { rating: true },
        _count: { _all: true }
      })
      .catch((error) => {
        if (isMissingTable(error, 'doctorreview')) {
          return { _avg: { rating: 0 }, _count: { _all: 0 } };
        }
        throw error;
      }),
    prisma.callSession
      .findMany({
        where: {
          startedAt: { not: null },
          appointment: {
            doctorId,
            startAt: { gte: since }
          }
        },
        select: {
          startedAt: true,
          appointment: { select: { startAt: true } }
        },
        take: 300,
        orderBy: { startedAt: 'desc' }
      })
      .catch((error) => {
        if (isMissingTable(error, 'callsession')) {
          return [];
        }
        throw error;
      })
  ]);

  const statusCountMap = statusRows.reduce((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const totalAppointments = Object.values(statusCountMap).reduce((sum, value) => sum + Number(value || 0), 0);
  const completedAppointments = Number(statusCountMap.completed || 0);
  const noShowAppointments = Number(statusCountMap.no_show || 0);

  const completionRate = totalAppointments ? completedAppointments / totalAppointments : 0;
  const noShowRate = totalAppointments ? noShowAppointments / totalAppointments : 0;

  const ratingAverage = Number(reviewStats._avg.rating || 0);
  const ratingCount = Number(reviewStats._count._all || 0);
  const ratingScore = ratingAverage ? Math.min(1, Math.max(0, ratingAverage / 5)) : 0.5;

  const responseSamples = callSessions
    .map((session) => {
      const start = new Date(session.startedAt).getTime();
      const slot = new Date(session.appointment.startAt).getTime();
      const mins = (start - slot) / 60000;
      return Number.isFinite(mins) ? Math.max(0, mins) : null;
    })
    .filter((value) => value !== null);

  const responseMinutes = responseSamples.length
    ? Math.round(responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length)
    : null;
  const responseScore = responseScoreFromMinutes(responseMinutes);

  const weightedScore = (completionRate * 0.4 + ratingScore * 0.35 + responseScore * 0.25) * 100;
  const score = Math.max(0, Math.min(100, Math.round(weightedScore)));

  return {
    score,
    band: trustBand(score),
    windowDays: TRUST_WINDOW_DAYS,
    metrics: {
      totalAppointments,
      completionRatePct: toPercent(completedAppointments, totalAppointments),
      noShowRatePct: toPercent(noShowAppointments, totalAppointments),
      ratingAverage: Number(ratingAverage.toFixed(2)),
      ratingCount,
      avgResponseMinutes: responseMinutes
    }
  };
}

module.exports = { computeDoctorTrustScore };
