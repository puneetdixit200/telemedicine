require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { uploadBuffer, localUploadsRoot, assertAzureReady } = require('../services/storage.service');

async function listFilesRecursively(rootDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  if (!fs.existsSync(rootDir)) return files;
  await walk(rootDir);
  return files;
}

async function removeEmptyDirs(rootDir) {
  if (!fs.existsSync(rootDir)) return;

  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await walk(path.join(currentDir, entry.name));
    }

    const remaining = await fs.promises.readdir(currentDir);
    if (remaining.length === 0 && currentDir !== rootDir) {
      await fs.promises.rmdir(currentDir);
    }
  }

  await walk(rootDir);
}

function contentTypeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

async function main() {
  const shouldDeleteLocal = process.argv.includes('--delete-local');
  await assertAzureReady();

  const uploadsRoot = localUploadsRoot();
  const files = await listFilesRecursively(uploadsRoot);

  if (files.length === 0) {
    console.log('[migrate] No local upload files found.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const filePath of files) {
    const rel = path.relative(uploadsRoot, filePath).split(path.sep).join('/');
    try {
      const buffer = await fs.promises.readFile(filePath);
      await uploadBuffer({
        blobName: rel,
        buffer,
        contentType: contentTypeFromName(filePath)
      });
      if (shouldDeleteLocal) {
        await fs.promises.unlink(filePath);
      }
      console.log('[migrate] Uploaded:', rel);
      success += 1;
    } catch (err) {
      console.error('[migrate] Failed:', rel, '-', err.message);
      failed += 1;
    }
  }

  if (shouldDeleteLocal && failed === 0) {
    await removeEmptyDirs(uploadsRoot);
    console.log('[migrate] Local uploaded files were removed after successful migration.');
  }

  console.log(`[migrate] Completed. success=${success} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err.message);
  process.exit(1);
});
