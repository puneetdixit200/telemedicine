const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function normalizeLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return LEVEL_PRIORITY[normalized] ? normalized : null;
}

function defaultLevelForEnvironment() {
  const env = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (env === 'development') return 'debug';
  if (env === 'test') return 'warn';
  return 'info';
}

function configuredLevel() {
  const fromEnv = normalizeLevel(process.env.LOG_LEVEL);
  return fromEnv || defaultLevelForEnvironment();
}

function shouldLog(level) {
  const messagePriority = LEVEL_PRIORITY[level] || LEVEL_PRIORITY.info;
  const minPriority = LEVEL_PRIORITY[configuredLevel()] || LEVEL_PRIORITY.info;
  return messagePriority >= minPriority;
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(line);
}

const logger = {
  debug(message, meta = {}) {
    write('debug', message, meta);
  },
  info(message, meta = {}) {
    write('info', message, meta);
  },
  warn(message, meta = {}) {
    write('warn', message, meta);
  },
  error(message, meta = {}) {
    write('error', message, meta);
  }
};

module.exports = { logger };
