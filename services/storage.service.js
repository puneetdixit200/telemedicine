const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');

function getContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER || 'patient-documents';
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

async function uploadBuffer({ blobName, buffer, contentType }) {
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

module.exports = { uploadBuffer, getReadSasUrl };
