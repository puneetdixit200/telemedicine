import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest, utcDateTime } from '../lib/api';

function messageFromResponse(response, fallback) {
  return response?.data?.error || response?.data?.message || fallback;
}

function extractToken(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^[a-f0-9]{40,}$/i.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const queryToken = String(parsed.searchParams.get('token') || '').trim();
    if (queryToken) return queryToken;
    const match = parsed.pathname.match(/\/public\/records\/([a-f0-9]{40,})/i);
    if (match?.[1]) return match[1];
  } catch (_error) {
    const fromQuery = raw.match(/[?&]token=([a-zA-Z0-9_-]+)/);
    if (fromQuery?.[1]) return fromQuery[1];
    const fromPath = raw.match(/\/public\/records\/([a-f0-9]{40,})/i);
    if (fromPath?.[1]) return fromPath[1];
  }

  return raw;
}

function PatientSummary({ data }) {
  const patient = data?.patient;
  if (!patient) return null;

  return (
    <section className="card stack">
      <h3>Patient profile</h3>
      <p><strong>Name:</strong> {patient.fullName || 'N/A'}</p>
      <p><strong>Patient ID:</strong> {patient.id || 'N/A'}</p>
      <p><strong>Phone:</strong> {patient.phone || 'N/A'}</p>
      <p><strong>Email:</strong> {patient.email || 'N/A'}</p>
      <p><strong>Gender:</strong> {patient.gender || 'N/A'}</p>
      <p><strong>Date of birth:</strong> {patient.dateOfBirth ? utcDateTime(patient.dateOfBirth) : 'N/A'}</p>
      <p><strong>Address:</strong> {patient.address || 'N/A'}</p>
      <p><strong>Language:</strong> {patient.language || 'N/A'}</p>
      <p><strong>Chronic conditions:</strong> {patient.chronicConditions || 'N/A'}</p>
      <p><strong>Basic health info:</strong> {patient.basicHealthInfo || 'N/A'}</p>
      <p><strong>ABHA ID:</strong> {patient.abhaId || 'N/A'}</p>
      <p><strong>ABHA Address:</strong> {patient.abhaAddress || 'N/A'}</p>
    </section>
  );
}

export default function DoctorPatientAccessPage() {
  const location = useLocation();
  const initialToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('token') || '').trim();
  }, [location.search]);

  const [patientId, setPatientId] = useState('');
  const [shareLink, setShareLink] = useState(initialToken);
  const [result, setResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const lookupByPatientId = async (event) => {
    event.preventDefault();
    const id = String(patientId || '').trim();
    if (!id) {
      setStatusMessage('Enter a patient ID.');
      return;
    }

    setBusy(true);
    setStatusMessage('');

    const res = await apiRequest(`/api/innovations/patients/${id}/full-details`);

    setBusy(false);

    if (!res.ok) {
      setResult(null);
      setStatusMessage(messageFromResponse(res, 'Could not fetch patient details.'));
      return;
    }

    setResult(res.data || null);
    setStatusMessage('Patient details loaded by Patient ID.');
  };

  const lookupByShareToken = async (event) => {
    event.preventDefault();
    const token = extractToken(shareLink);
    if (!token) {
      setStatusMessage('Paste the QR share link or token.');
      return;
    }

    setBusy(true);
    setStatusMessage('');

    const res = await apiRequest(`/api/innovations/patients/access-by-token/${encodeURIComponent(token)}`);

    setBusy(false);

    if (!res.ok) {
      setResult(null);
      setStatusMessage(messageFromResponse(res, 'Could not fetch patient details from share token.'));
      return;
    }

    setResult(res.data || null);
    setStatusMessage('Patient details loaded using shared QR link/token.');
  };

  const appointments = Array.isArray(result?.recentAppointments) ? result.recentAppointments : [];
  const vitals = Array.isArray(result?.recentVitals) ? result.recentVitals : [];
  const documents = Array.isArray(result?.recentDocuments) ? result.recentDocuments : [];
  const carePlans = Array.isArray(result?.chronicCarePlans) ? result.chronicCarePlans : [];
  const familyMembers = Array.isArray(result?.patient?.familyMembers) ? result.patient.familyMembers : [];

  return (
    <section className="stack">
      <article className="card stack">
        <p className="kicker">Doctor Workspace</p>
        <h2>Patient Access Console</h2>
        <p className="muted">View full patient details either by Patient ID or by scanning/pasting the shared QR link.</p>
      </article>

      <article className="card stack">
        <h3>Find by Patient ID</h3>
        <form className="stack" onSubmit={lookupByPatientId}>
          <input
            placeholder="Patient ID"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Loading...' : 'View Patient Details'}
          </button>
        </form>
      </article>

      <article className="card stack">
        <h3>Find by QR Share Link</h3>
        <form className="stack" onSubmit={lookupByShareToken}>
          <textarea
            placeholder="Paste scanned QR link or token"
            rows={3}
            value={shareLink}
            onChange={(event) => setShareLink(event.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Loading...' : 'Open Shared Patient Record'}
          </button>
        </form>
      </article>

      {statusMessage ? (
        <article className="card">
          <p>{statusMessage}</p>
        </article>
      ) : null}

      {result ? (
        <>
          <PatientSummary data={result} />

          <article className="card stack">
            <h3>Family Members</h3>
            {familyMembers.length ? (
              <ul className="list-clean">
                {familyMembers.map((member) => (
                  <li key={member.id}>
                    <strong>{member.fullName}</strong> ({member.relationToPatient || 'Relation not set'})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No linked family members found.</p>
            )}
          </article>

          <article className="card stack">
            <h3>Recent Appointments</h3>
            {appointments.length ? (
              <ul className="list-clean">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <strong>{utcDateTime(appointment.startAt)}</strong> | {appointment.status} | Doctor: {appointment.doctor?.fullName || 'N/A'}
                    {appointment.prescription?.diagnosis ? ` | Diagnosis: ${appointment.prescription.diagnosis}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No recent appointments available.</p>
            )}
          </article>

          <article className="card stack">
            <h3>Recent Vitals</h3>
            {vitals.length ? (
              <ul className="list-clean">
                {vitals.map((vital) => (
                  <li key={vital.id}>
                    <strong>{utcDateTime(vital.createdAt)}</strong> | BP: {vital.bpSystolic || '-'} / {vital.bpDiastolic || '-'} | SpO2: {vital.spo2Percent || '-'} | Pulse: {vital.pulseBpm || '-'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No vitals recorded yet.</p>
            )}
          </article>

          <article className="card stack">
            <h3>Documents</h3>
            {documents.length ? (
              <ul className="list-clean">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <strong>{doc.fileName}</strong> | {doc.contentType || 'file'} | {utcDateTime(doc.createdAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No documents found.</p>
            )}
          </article>

          <article className="card stack">
            <h3>Chronic Care Plans</h3>
            {carePlans.length ? (
              <ul className="list-clean">
                {carePlans.map((plan) => (
                  <li key={plan.id}>
                    <strong>{plan.condition}</strong> | Status: {plan.status} | Next check-in: {plan.nextCheckInAt ? utcDateTime(plan.nextCheckInAt) : 'N/A'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No chronic care plans found.</p>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
