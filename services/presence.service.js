const ONLINE_WINDOW_MS = 70 * 1000;

function isRecentlyOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

function getAppointmentPresence(appointment) {
  const doctorHeartbeatOnline = isRecentlyOnline(appointment.doctor?.lastSeenAt);
  const patientHeartbeatOnline = isRecentlyOnline(appointment.patient?.lastSeenAt);

  const doctorAcceptingCalls = Boolean(appointment.doctor?.doctorProfile?.callEnabled);
  const doctorOnline = doctorHeartbeatOnline && doctorAcceptingCalls;
  const patientOnline = patientHeartbeatOnline;

  return {
    doctorOnline,
    patientOnline,
    doctorAcceptingCalls,
    canStartCall: doctorOnline && patientOnline
  };
}

module.exports = { ONLINE_WINDOW_MS, isRecentlyOnline, getAppointmentPresence };
