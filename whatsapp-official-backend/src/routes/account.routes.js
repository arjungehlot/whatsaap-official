const router = require('express').Router();
const crypto = require('crypto');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { error, plain } = require('../services/data.service');
const domain = require('../services/domain.service');
const { hashSecret } = require('../utils/crypto');

const roles = new Set(['owner', 'admin', 'agent', 'viewer']);
function safeKey(row) {
  const { key_hash, ...safe } = row;
  return safe;
}
function token() {
  return crypto.randomBytes(32).toString('base64url');
}
function publicOrigin(req) {
  return (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`)
    .split(',')[0]
    .replace(/\/$/, '');
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const account = await domain
      .model('accounts')
      .findOne({ id: domain.accountId(req.auth) })
      .lean();
    if (!account) throw error('Account not found', 404);
    res.json({ account: plain(account), role: req.auth.role });
  } catch (cause) {
    next(cause);
  }
});
router.patch('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = domain.assertString(req.body?.name, 'name', 80);
    const account = await domain
      .model('accounts')
      .findOneAndUpdate(
        { id: domain.accountId(req.auth) },
        { $set: { name, updated_at: domain.now() } },
        { new: true }
      );
    if (!account) throw error('Account not found', 404);
    res.json({ account: plain(account) });
  } catch (cause) {
    next(cause);
  }
});

router.get('/members', requireAuth, async (req, res, next) => {
  try {
    const canSeeEmail =
      ['owner', 'admin'].includes(req.auth.role) || req.auth.service;
    const profiles = await domain
      .model('profiles')
      .find({ account_id: domain.accountId(req.auth) })
      .sort({ created_at: 1 })
      .lean();
    const members = profiles
      .filter((row) => roles.has(row.account_role))
      .map((row) => ({
        user_id: row.user_id,
        full_name: row.full_name || '',
        email: canSeeEmail ? row.email || null : null,
        avatar_url: row.avatar_url || null,
        role: row.account_role,
        joined_at: row.created_at,
      }));
    res.json({ members });
  } catch (cause) {
    next(cause);
  }
});
router.patch(
  '/members/:userId',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const role = req.body?.role;
      if (!roles.has(role) || role === 'owner')
        throw error('role must be admin, agent, or viewer');
      const target = await domain
        .model('profiles')
        .findOne({
          account_id: domain.accountId(req.auth),
          user_id: req.params.userId,
        });
      if (!target) throw error('Member not found', 404);
      if (target.account_role === 'owner')
        throw error('Transfer ownership before changing the owner role', 409);
      target.account_role = role;
      target.updated_at = domain.now();
      await target.save();
      res.json({
        member: {
          user_id: target.user_id,
          full_name: target.full_name || '',
          email: target.email || null,
          avatar_url: target.avatar_url || null,
          role: target.account_role,
          joined_at: target.created_at,
        },
      });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/members/:userId',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const target = await domain
        .model('profiles')
        .findOne({
          account_id: domain.accountId(req.auth),
          user_id: req.params.userId,
        });
      if (!target) throw error('Member not found', 404);
      if (target.account_role === 'owner')
        throw error('Transfer ownership before removing the owner', 409);
      await target.deleteOne();
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/transfer-ownership',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (req.auth.role !== 'owner')
        throw error('Only the account owner can transfer ownership', 403);
      const targetUserId =
        typeof req.body?.user_id === 'string' ? req.body.user_id : '';
      const target = await domain
        .model('profiles')
        .findOne({
          account_id: domain.accountId(req.auth),
          user_id: targetUserId,
        });
      if (!target) throw error('Member not found', 404);
      await domain
        .model('profiles')
        .updateOne(
          { account_id: domain.accountId(req.auth), user_id: req.auth.sub },
          { $set: { account_role: 'admin', updated_at: domain.now() } }
        );
      await domain
        .model('profiles')
        .updateOne(
          { account_id: domain.accountId(req.auth), user_id: targetUserId },
          { $set: { account_role: 'owner', updated_at: domain.now() } }
        );
      await domain
        .model('accounts')
        .updateOne(
          { id: domain.accountId(req.auth) },
          { $set: { owner_user_id: targetUserId, updated_at: domain.now() } }
        );
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);

router.get(
  '/invitations',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      res.json({
        invitations: await domain.many('account_invitations', req.auth),
      });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/invitations',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const email = domain
        .assertString(req.body?.email, 'email', 254)
        .toLowerCase();
      const role = req.body?.role || 'agent';
      if (!roles.has(role) || role === 'owner')
        throw error('Invalid invitation role');
      const raw = token();
      const expires_at = new Date(
        Date.now() +
          Math.min(Math.max(Number(req.body?.expiresInDays || 7), 1), 30) *
            86400000
      );
      const invitation = await domain.insert('account_invitations', req.auth, {
        email,
        role,
        invited_by: domain.userId(req.auth),
        token_hash: hashSecret(raw),
        expires_at,
        status: 'pending',
      });
      res
        .status(201)
        .json({ invitation, invite_url: `${publicOrigin(req)}/join/${raw}` });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/invitations/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const invitation = await domain.removeOne(
        'account_invitations',
        req.auth,
        req.params.id
      );
      if (!invitation) throw error('Invitation not found', 404);
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);

router.get('/api-keys', requireAuth, async (req, res, next) => {
  try {
    const rows = await domain.many('api_keys', req.auth);
    res.json({ keys: rows.map(safeKey) });
  } catch (cause) {
    next(cause);
  }
});
router.post('/api-keys', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = domain.assertString(req.body?.name, 'name', 80);
    const raw = `wacrm_${crypto.randomBytes(32).toString('base64url')}`;
    const scopes = Array.isArray(req.body?.scopes)
      ? req.body.scopes.filter(
          (scope) => typeof scope === 'string' && scope.length <= 100
        )
      : [];
    const days = Number(req.body?.expiresInDays);
    const expires_at =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + Math.min(Math.floor(days), 365) * 86400000)
        : null;
    const key = await domain.insert('api_keys', req.auth, {
      name,
      key_prefix: raw.slice(0, 14),
      key_hash: hashSecret(raw),
      scopes,
      expires_at,
      created_by: domain.userId(req.auth),
    });
    res.status(201).json({ key: safeKey(key), plaintext: raw });
  } catch (cause) {
    next(cause);
  }
});
router.delete(
  '/api-keys/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const key = await domain.updateOne('api_keys', req.auth, req.params.id, {
        revoked_at: domain.now(),
      });
      if (!key) throw error('API key not found', 404);
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);
module.exports = router;
