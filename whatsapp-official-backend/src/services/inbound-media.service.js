const path = require('path');
const { randomUUID } = require('crypto');
const meta = require('./meta.service');
const { error } = require('./data.service');
const { safeSegment, uploadObject } = require('./s3-storage.service');

const MAX_INBOUND_MEDIA_BYTES = Number(
  process.env.MAX_INBOUND_MEDIA_BYTES || 16 * 1024 * 1024
);

function extensionFor(mediaType, contentType) {
  const fromMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
  }[String(contentType || '').toLowerCase()];
  return fromMime || { image: '.jpg', video: '.mp4', audio: '.ogg' }[mediaType] || '';
}

async function mirrorInboundMedia({ accountId, messageId, mediaId, mediaType, accessToken }) {
  if (!mediaId) return null;
  const metadata = await meta.request(`/${encodeURIComponent(mediaId)}`, accessToken);
  const declaredSize = Number(metadata.file_size || 0);
  if (declaredSize > MAX_INBOUND_MEDIA_BYTES) {
    console.info(`[whatsapp] Skipped inbound media ${mediaId}: exceeds ${MAX_INBOUND_MEDIA_BYTES} bytes.`);
    return null;
  }
  if (!metadata.url) throw error('Meta did not provide an inbound media URL', 502);

  const response = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw error(`Unable to download inbound media (${response.status})`, 502);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_INBOUND_MEDIA_BYTES) {
    console.info(`[whatsapp] Skipped inbound media ${mediaId}: response exceeds ${MAX_INBOUND_MEDIA_BYTES} bytes.`);
    return null;
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_INBOUND_MEDIA_BYTES) {
    console.info(`[whatsapp] Skipped inbound media ${mediaId}: download exceeds ${MAX_INBOUND_MEDIA_BYTES} bytes.`);
    return null;
  }

  const contentType = metadata.mime_type || response.headers.get('content-type') || 'application/octet-stream';
  const filename = metadata.filename || `attachment${extensionFor(mediaType, contentType)}`;
  const safeFilename = String(filename).replace(/["\\]/g, '_');
  const key = `inbound/${safeSegment(accountId, 'account')}/${safeSegment(messageId || randomUUID(), 'message')}${extensionFor(mediaType, contentType)}`;
  return uploadObject({
    key,
    body,
    contentType,
    contentDisposition: `inline; filename="${safeFilename}"`,
  });
}

module.exports = { mirrorInboundMedia, MAX_INBOUND_MEDIA_BYTES };
