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
      await maybeMakeOffer();
    }
  });

  socket.on('signal', async ({ type, payload }) => {
    try {
      if (!pc) await setupPeerConnection();

      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { appointmentId: cfg.appointmentId, type: 'answer', payload: pc.localDescription });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ice_candidate') {
        if (payload) await pc.addIceCandidate(payload);
      }
    } catch (e) {
      console.error(e);
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

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ensureSocket().emit('signal', { appointmentId: cfg.appointmentId, type: 'ice_candidate', payload: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    setStatus(`pc:${pc.connectionState}`);
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
  if (pc.signalingState !== 'stable') return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ensureSocket().emit('signal', { appointmentId: cfg.appointmentId, type: 'offer', payload: pc.localDescription });
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
