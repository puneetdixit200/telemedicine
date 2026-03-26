/* global io, RTCPeerConnection, RTCSessionDescription */

const configNode = document.getElementById('callRuntimeConfig');
const encodedConfig = configNode ? configNode.getAttribute('data-call-config') : null;
const cfg = encodedConfig ? JSON.parse(decodeURIComponent(encodedConfig)) : null;

if (!cfg) {
  throw new Error('Missing call runtime config');
}

const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const btnVideo = document.getElementById('btnVideo');
const btnAudio = document.getElementById('btnAudio');
const btnText = document.getElementById('btnText');
const btnMute = document.getElementById('btnMute');
const btnCamera = document.getElementById('btnCamera');

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let socket;
let pc;
let localStream;
let currentMode = cfg.defaultMode;
let isMuted = false;
let isCameraOff = false;
let makingOffer = false;
let ignoreOffer = false;
let isSettingRemoteAnswerPending = false;
const pendingIceCandidates = [];

// Doctor acts as the stable offerer by default; patient is the polite peer.
const isPolitePeer = cfg.userRole === 'patient';

function logRtc(event, details = {}) {
  console.log('[CALL][RTC]', event, {
    appointmentId: cfg.appointmentId,
    mode: currentMode,
    signalingState: pc ? pc.signalingState : 'no-pc',
    connectionState: pc ? pc.connectionState : 'no-pc',
    ...details
  });
}

function setStatus(s) {
  statusEl.textContent = s;
}

function appendChat(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function ensureSocket() {
  if (socket) return socket;
  socket = io({ auth: { token: cfg.socketToken } });

  socket.on('connect', () => {
    setStatus('connected');
    socket.emit('join_room', { appointmentId: cfg.appointmentId });
  });

  socket.on('disconnect', () => {
    setStatus('disconnected');
  });

  socket.on('peer_joined', async () => {
    // If we already have local media and a PC, try offering again.
    if (pc && (currentMode === 'video' || currentMode === 'audio')) {
      logRtc('peer_joined');
      await maybeMakeOffer();
    }
  });

  socket.on('signal', async ({ type, payload }) => {
    try {
      if (!pc) await setupPeerConnection();

      if (type === 'offer') {
        const offerCollision = makingOffer || pc.signalingState !== 'stable';
        ignoreOffer = !isPolitePeer && offerCollision;

        if (ignoreOffer) {
          logRtc('ignore_offer_collision', { isPolitePeer, offerCollision });
          return;
        }

        if (offerCollision && isPolitePeer) {
          logRtc('rollback_for_offer_collision', { isPolitePeer, offerCollision });
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(payload))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }

        while (pendingIceCandidates.length) {
          const candidate = pendingIceCandidates.shift();
          if (!candidate) continue;
          await pc.addIceCandidate(candidate);
        }

        logRtc('remote_offer_applied');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { appointmentId: cfg.appointmentId, type: 'answer', payload: pc.localDescription });
      } else if (type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') {
          logRtc('ignore_unexpected_answer', { receivedType: type });
          return;
        }

        isSettingRemoteAnswerPending = true;
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        isSettingRemoteAnswerPending = false;

        while (pendingIceCandidates.length) {
          const candidate = pendingIceCandidates.shift();
          if (!candidate) continue;
          await pc.addIceCandidate(candidate);
        }

        logRtc('remote_answer_applied');
      } else if (type === 'ice_candidate') {
        if (!payload) return;
        const candidate = new RTCIceCandidate(payload);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingIceCandidates.push(candidate);
          logRtc('queue_remote_ice', { queued: pendingIceCandidates.length });
        }
      }
    } catch (e) {
      isSettingRemoteAnswerPending = false;
      console.error('[CALL][RTC] signal handling error', e, {
        type,
        signalingState: pc ? pc.signalingState : 'no-pc',
        connectionState: pc ? pc.connectionState : 'no-pc'
      });
      setStatus('signal_error');
    }
  });

  socket.on('chat', ({ fromName, message, at }) => {
    appendChat(`[${new Date(at).toLocaleTimeString()}] ${fromName}: ${message}`);
  });

  return socket;
}

async function setupLocalMedia(mode) {
  if (mode === 'text') {
    localVideo.srcObject = null;
    return;
  }

  const constraints =
    mode === 'audio'
      ? { audio: true, video: false }
      : { audio: true, video: { width: { ideal: 640 }, height: { ideal: 360 } } };

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;
}

async function setupPeerConnection() {
  if (pc) return pc;

  pc = new RTCPeerConnection({ iceServers: cfg.iceServers });
  logRtc('pc_created', { isPolitePeer, iceServers: cfg.iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      logRtc('local_ice_candidate');
      ensureSocket().emit('signal', { appointmentId: cfg.appointmentId, type: 'ice_candidate', payload: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    logRtc('remote_track_received', { streams: event.streams ? event.streams.length : 0 });
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    logRtc('connection_state_change');
    setStatus(`pc:${pc.connectionState}`);
  };

  pc.oniceconnectionstatechange = () => {
    logRtc('ice_connection_state_change', { iceConnectionState: pc.iceConnectionState });
  };

  pc.onsignalingstatechange = () => {
    logRtc('signaling_state_change', { signalingState: pc.signalingState, isSettingRemoteAnswerPending });
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  return pc;
}

async function maybeMakeOffer() {
  if (!pc) return;
  if (pc.signalingState !== 'stable') {
    logRtc('skip_offer_non_stable');
    return;
  }

  try {
    makingOffer = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    logRtc('local_offer_created');
    ensureSocket().emit('signal', { appointmentId: cfg.appointmentId, type: 'offer', payload: pc.localDescription });
  } catch (e) {
    console.error('[CALL][RTC] offer creation failed', e);
  } finally {
    makingOffer = false;
  }
}

async function startMode(mode) {
  currentMode = mode;
  ensureSocket();

  if (mode === 'text') {
    setStatus('text');
    return;
  }

  try {
    setStatus('starting_media');
    await setupLocalMedia(mode);
    await setupPeerConnection();
    await maybeMakeOffer();
    setStatus('in_call');
  } catch (e) {
    console.error(e);
    setStatus('media_error');
    alert('Camera/mic error. Check browser permissions.');
  }
}

btnVideo.addEventListener('click', () => startMode('video'));
btnAudio.addEventListener('click', () => startMode('audio'));
btnText.addEventListener('click', () => startMode('text'));

btnMute.addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach((t) => {
    t.enabled = !isMuted;
  });
  btnMute.textContent = isMuted ? 'Unmute' : 'Mute';
});

btnCamera.addEventListener('click', () => {
  if (!localStream) return;
  isCameraOff = !isCameraOff;
  localStream.getVideoTracks().forEach((t) => {
    t.enabled = !isCameraOff;
  });
  btnCamera.textContent = isCameraOff ? 'Camera on' : 'Toggle camera';
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = String(chatInput.value || '').trim();
  if (!message) return;
  ensureSocket().emit('chat', { appointmentId: cfg.appointmentId, message });
  chatInput.value = '';
});

// Auto-start the configured mode.
startMode(cfg.defaultMode);
