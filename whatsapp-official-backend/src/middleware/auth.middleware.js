const jwt = require('jsonwebtoken');
const { error } = require('../services/data.service');

function readCookie(req, name) {
  const raw = req.get('cookie') || '';
  const pair = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

function requireAuth(req, res, next) {
  try {
    const internalKey = req.get('x-internal-api-key');
    if (
      process.env.INTERNAL_API_KEY &&
      internalKey === process.env.INTERNAL_API_KEY
    ) {
      req.auth = { service: true, role: 'owner' };
      return next();
    }
    // The React application uses Authorization for API-client calls and the
    // same-site cookie for existing relative fetch('/api/...') calls. Both
    // paths verify the exact same short-lived signed JWT here.
    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const token = bearer || readCookie(req, 'wacrm_token');
    if (!token) throw error('Unauthorized', 401);
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (cause) {
    return next(cause.status ? cause : error('Unauthorized', 401));
  }
}

function requireWriter(req, res, next) {
  if (req.auth?.service || ['owner', 'admin', 'agent'].includes(req.auth?.role))
    return next();
  return next(error('Insufficient role', 403));
}

function requireAdmin(req, res, next) {
  if (req.auth?.service || ['owner', 'admin'].includes(req.auth?.role))
    return next();
  return next(error('Insufficient role', 403));
}

module.exports = { requireAuth, requireWriter, requireAdmin };
