const META_API_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

async function request(path, accessToken, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(process.env.META_REQUEST_TIMEOUT_MS || 30000)
  );
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        body?.error?.message || `Meta API request failed (${response.status})`
      );
      error.status =
        response.status === 401 || response.status === 403 ? 400 : 502;
      error.code = body?.error?.code;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function verifyPhoneNumber(phoneNumberId, accessToken) {
  return request(
    `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
    accessToken
  );
}

function registerPhoneNumber(phoneNumberId, accessToken, pin) {
  return request(
    `/${encodeURIComponent(phoneNumberId)}/register`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    }
  );
}

function subscribeWaba(wabaId, accessToken) {
  return request(
    `/${encodeURIComponent(wabaId)}/subscribed_apps`,
    accessToken,
    { method: 'POST' }
  );
}

function sendMessage(phoneNumberId, accessToken, payload) {
  return request(
    `/${encodeURIComponent(phoneNumberId)}/messages`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    }
  );
}

async function uploadMedia(phoneNumberId, accessToken, file) {
  if (!file?.buffer?.length) throw new Error('A media file is required');
  const form = new FormData();
  form.set('messaging_product', 'whatsapp');
  form.set(
    'file',
    new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
    file.originalname || 'upload.bin'
  );
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(phoneNumberId)}/media`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const cause = new Error(body?.error?.message || `Meta media upload failed (${response.status})`);
    cause.status = response.status === 401 || response.status === 403 ? 400 : 502;
    cause.code = body?.error?.code;
    throw cause;
  }
  return body;
}

function getMedia(mediaId, accessToken) {
  return request(`/${encodeURIComponent(mediaId)}`, accessToken);
}

module.exports = {
  request,
  verifyPhoneNumber,
  registerPhoneNumber,
  subscribeWaba,
  sendMessage,
  uploadMedia,
  getMedia,
};
