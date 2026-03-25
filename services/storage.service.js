const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

function getContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER || 'patient-documents';
}

function getUploadsMode() {
  return String(process.env.AZURE_UPLOADS_MODE || 'azure-only').toLowerCase();
}

function requireConnString() {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) {
    const err = new Error('Azure storage is not configured (AZURE_STORAGE_CONNECTION_STRING missing).');
    err.status = 500;
    throw err;
  }
  return cs;
}

function hasUsableAzureConnectionString() {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!cs.trim()) return false;
  try {
    const parsed = parseAccountFromConnectionString(cs);
    if (!parsed.accountName || !parsed.accountKey) return false;
    BlobServiceClient.fromConnectionString(cs);
    return true;
  } catch (_) {
    return false;
  }
}

function isAzureConfigured() {
  return hasUsableAzureConnectionString();
}

function localUploadsRoot() {
  return path.join(process.cwd(), 'uploads');
}

function getLocalFilePath(blobName) {
  return path.join(localUploadsRoot(), blobName);
}

async function uploadBufferLocal({ blobName, buffer }) {
  const root = localUploadsRoot();
  const filePath = getLocalFilePath(blobName);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
  return { blobName };
}

function parseAccountFromConnectionString(connectionString) {
  const parts = connectionString.split(';').filter(Boolean);
  const map = {};
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    map[k] = rest.join('=');
  }
  return {
    accountName: map.AccountName,
    accountKey: map.AccountKey
  };
}

async function getContainerClient() {
  const service = BlobServiceClient.fromConnectionString(requireConnString());
  const container = service.getContainerClient(getContainerName());
  await container.createIfNotExists();
  return container;
}

async function assertAzureReady() {
  if (!hasUsableAzureConnectionString()) {
    const err = new Error('Azure storage is not configured or connection string is invalid.');
    err.status = 500;
    throw err;
  }
  await getContainerClient();
}

async function uploadBuffer({ blobName, buffer, contentType }) {
  const mode = getUploadsMode();
  const azureReady = hasUsableAzureConnectionString();

  if (mode !== 'local-only' && !azureReady) {
    const err = new Error('Azure-only upload mode is enabled, but Azure storage is not configured.');
    err.status = 500;
    throw err;
  }

  if (mode === 'local-only') {
    return uploadBufferLocal({ blobName, buffer });
  }

  const container = await getContainerClient();
  const client = container.getBlockBlobClient(blobName);
  await client.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType
    }
  });
  return { blobName };
}

function getReadSasUrl({ blobName, expiresInMinutes = 10 }) {
  if (!hasUsableAzureConnectionString()) {
    return `/documents/local/${encodeURIComponent(blobName)}`;
  }

  const connectionString = requireConnString();
  const { accountName, accountKey } = parseAccountFromConnectionString(connectionString);
  if (!accountName || !accountKey) {
    const err = new Error('Azure storage connection string is missing AccountName/AccountKey.');
    err.status = 500;
    throw err;
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const containerName = getContainerName();
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      expiresOn,
      permissions: BlobSASPermissions.parse('r')
    },
    credential
  ).toString();

  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURI(blobName)}?${sas}`;
}

module.exports = {
  uploadBuffer,
  getReadSasUrl,
  getLocalFilePath,
  localUploadsRoot,
  getUploadsMode,
  isAzureConfigured,
  assertAzureReady
};
