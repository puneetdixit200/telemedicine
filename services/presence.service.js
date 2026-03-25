const ONLINE_WINDOW_MS = 70 * 1000;

function isRecentlyOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

function getAppointmentPresence(appointment) {
  const isOpen = appointment.status === 'booked';
  const doctorHeartbeatOnline = isRecentlyOnline(appointment.doctor?.lastSeenAt);
  const patientHeartbeatOnline = isRecentlyOnline(appointment.patient?.lastSeenAt);

  const doctorAcceptingCalls = Boolean(appointment.doctor?.doctorProfile?.callEnabled);
  const doctorOnline = doctorHeartbeatOnline && doctorAcceptingCalls;
  const patientOnline = patientHeartbeatOnline;

  return {
    isOpen,
    doctorOnline,
    patientOnline,
    doctorAcceptingCalls,
    canStartCall: isOpen && doctorOnline && patientOnline
  };
}

module.exports = { ONLINE_WINDOW_MS, isRecentlyOnline, getAppointmentPresence };
