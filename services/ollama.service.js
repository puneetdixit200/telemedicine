const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);

function getOllamaBaseUrl() {
  return String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function getOllamaModel() {
  return String(process.env.OLLAMA_MODEL || 'llama3.1:8b').trim();
}

function isOllamaConfigured() {
  return Boolean(getOllamaBaseUrl() && getOllamaModel());
}

function extractResponseText(payload) {
  if (!payload) return '';
  if (typeof payload.response === 'string') return payload.response.trim();
  if (typeof payload.message?.content === 'string') return payload.message.content.trim();
  return '';
}

async function ollamaGenerate({ systemPrompt, userPrompt, temperature = 0.2, maxTokens = 900 }) {
  if (!isOllamaConfigured()) {
    const error = new Error('Ollama is not configured. Set OLLAMA_BASE_URL and OLLAMA_MODEL.');
    error.status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getOllamaModel(),
        system: String(systemPrompt || ''),
        prompt: String(userPrompt || ''),
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const error = new Error(`Ollama request failed (${res.status}). ${text || 'No additional details.'}`);
      error.status = 502;
      throw error;
    }

    const payload = await res.json();
    const text = extractResponseText(payload);
    if (!text) {
      const error = new Error('Ollama returned an empty response.');
      error.status = 502;
      throw error;
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Ollama request timed out. Try a shorter prompt or increase OLLAMA_TIMEOUT_MS.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function tryParseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_err) {
    // Continue and try block extraction.
  }

  const jsonBlock = raw.match(/\{[\s\S]*\}/);
  if (!jsonBlock) return null;

  try {
    return JSON.parse(jsonBlock[0]);
  } catch (_err) {
    return null;
  }
}

module.exports = {
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaConfigured,
  ollamaGenerate,
  tryParseJson
};
