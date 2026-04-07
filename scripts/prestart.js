const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function runStep(command, args, label) {
  // eslint-disable-next-line no-console
  console.log(`[prestart] ${label}`);

  const useShell = process.platform === 'win32';

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: useShell,
    windowsHide: true
  });

  if (result.error) {
    const message = `[prestart] Failed: ${label} (${result.error.message})`;
    throw new Error(message);
  }

  if (result.status !== 0) {
    const message = `[prestart] Failed: ${label}`;
    throw new Error(message);
  }
}

function shouldRunPrestartTasks() {
  if (process.env.SKIP_PRESTART_TASKS === 'true') {
    return false;
  }

  return process.env.NODE_ENV === 'production' || process.env.FORCE_PRESTART_TASKS === 'true';
}

function ensureProdStartupArtifacts() {
  runStep('npx', ['prisma', 'generate'], 'Generating Prisma client');
  runStep('npx', ['prisma', 'migrate', 'deploy'], 'Applying Prisma migrations');

  const distIndexPath = path.join(process.cwd(), 'apps', 'frontend', 'dist', 'index.html');
  const forceFrontendBuild = process.env.FORCE_FRONTEND_BUILD === 'true';
  if (forceFrontendBuild || !fs.existsSync(distIndexPath)) {
    runStep('npm', ['run', 'frontend:build'], 'Building frontend bundle');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[prestart] Frontend build already present, skipping frontend build.');
}

function main() {
  if (!shouldRunPrestartTasks()) {
    // eslint-disable-next-line no-console
    console.log('[prestart] Skipping startup tasks (non-production mode).');
    return;
  }

  ensureProdStartupArtifacts();
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exit(1);
}
