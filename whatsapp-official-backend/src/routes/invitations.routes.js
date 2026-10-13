const router = require('express').Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');
const { hashSecret } = require('../utils/crypto');

async function invitation(raw) {
  const row = await domain
    .model('account_invitations')
    .findOne({ token_hash: hashSecret(raw), status: 'pending' })
    .lean();
  if (!row || (row.expires_at && new Date(row.expires_at) <= new Date()))
    throw error('Invitation is invalid or expired', 404);
  return row;
}
router.get('/:token/peek', async (req, res, next) => {
  try {
    const row = await invitation(req.params.token);
    const account = await domain
      .model('accounts')
      .findOne({ id: row.account_id })
      .lean();
    res.json({
      invitation: {
        email: row.email,
        role: row.role,
        expires_at: row.expires_at,
        account_name: account?.name || 'Account',
      },
    });
  } catch (cause) {
    next(cause);
  }
});
router.post('/:token/redeem', requireAuth, async (req, res, next) => {
  try {
    const row = await invitation(req.params.token);
    const profile = await domain
      .model('profiles')
      .findOne({ user_id: domain.userId(req.auth) });
    if (!profile) throw error('Your account profile is unavailable', 403);
    if (
      String(profile.email || '').toLowerCase() !==
      String(row.email).toLowerCase()
    )
      throw error(
        'Sign in with the email address this invitation was sent to',
        403
      );
    // A session has one active account. Move the profile atomically rather
    // than cloning it, otherwise a later login could resolve the old profile
    // and issue a JWT for the wrong tenant.
    await domain
      .model('profiles')
      .updateOne(
        { user_id: profile.user_id },
        {
          $set: {
            account_id: row.account_id,
            account_role: row.role,
            updated_at: domain.now(),
          },
        }
      );
    await domain
      .model('account_invitations')
      .updateOne(
        { id: row.id },
        {
          $set: {
            status: 'accepted',
            accepted_at: domain.now(),
            accepted_by: profile.user_id,
            updated_at: domain.now(),
          },
        }
      );
    res.json({ success: true, account_id: row.account_id });
  } catch (cause) {
    next(cause);
  }
});
module.exports = router;
