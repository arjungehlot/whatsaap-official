const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { error } = require('./data.service');

function required(name) {
  if (!process.env[name]) throw error(`${name} is not configured`, 503);
  return process.env[name];
}

function createS3Client() {
  // `smartitbox.bucket` contains a dot. Path-style requests prevent the
  // certificate mismatch virtual-hosted S3 URLs can cause for that name.
  return new S3Client({
    region: required('AWS_REGION'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required('AWS_ACCESS_KEY_ID'),
      secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    },
  });
}

function safeSegment(value, label) {
  const output = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!output || output === '.' || output === '..')
    throw error(`Invalid ${label}`);
  return output;
}

function publicUrl(key) {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (base) return `${base.replace(/\/$/, '')}/${encodedKey}`;
  return `https://s3.${required('AWS_REGION')}.amazonaws.com/${required('AWS_S3_BUCKET')}/${encodedKey}`;
}

function uploadWithTimeout(task) {
  const timeoutMs = Math.max(
    1000,
    Number(process.env.AWS_S3_UPLOAD_TIMEOUT_MS || 60000)
  );
  let timer;
  return Promise.race([
    task,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(error(`S3 upload timed out after ${timeoutMs}ms`, 504)),
        timeoutMs
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

async function uploadObject({ key, body, contentType, contentDisposition }) {
  await uploadWithTimeout(
    new Upload({
      client: createS3Client(),
      params: {
        Bucket: required('AWS_S3_BUCKET'),
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
        ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
      },
      queueSize: 3,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false,
    }).done()
  );
  return { key, publicUrl: publicUrl(key) };
}

module.exports = {
  required,
  createS3Client,
  safeSegment,
  publicUrl,
  uploadObject,
};
