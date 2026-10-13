const router = require('express').Router();
const { requireAuth, requireWriter } = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');

router.get('/tags', requireAuth, async (req, res, next) => {
  try {
    res.json({ tags: await domain.many('tags', req.auth) });
  } catch (cause) {
    next(cause);
  }
});
router.get('/contacts/:id/tags', requireAuth, async (req, res, next) => {
  try {
    const contact = await domain.one('contacts', req.auth, {
      id: req.params.id,
    });
    if (!contact) throw error('Contact not found', 404);
    const links = await domain.many('contact_tags', req.auth, {
      contact_id: contact.id,
    });
    const ids = links.map((link) => link.tag_id);
    const tags = ids.length
      ? await domain
          .model('tags')
          .find({ account_id: domain.accountId(req.auth), id: { $in: ids } })
          .lean()
      : [];
    res.json({ tags });
  } catch (cause) {
    next(cause);
  }
});
router.put(
  '/contacts/:id/tags',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const contact = await domain.one('contacts', req.auth, {
        id: req.params.id,
      });
      if (!contact) throw error('Contact not found', 404);
      if (
        !Array.isArray(req.body?.tag_ids) ||
        req.body.tag_ids.some((id) => typeof id !== 'string')
      )
        throw error('tag_ids must be an array of IDs');
      const tagIds = [...new Set(req.body.tag_ids)];
      const valid = tagIds.length
        ? await domain
            .model('tags')
            .countDocuments({
              account_id: domain.accountId(req.auth),
              id: { $in: tagIds },
            })
        : 0;
      if (valid !== tagIds.length)
        throw error('One or more tags do not belong to this account', 403);
      await domain
        .model('contact_tags')
        .deleteMany({
          account_id: domain.accountId(req.auth),
          contact_id: contact.id,
        });
      if (tagIds.length)
        await domain
          .model('contact_tags')
          .insertMany(
            tagIds.map((tag_id) => ({
              id: require('crypto').randomUUID(),
              account_id: domain.accountId(req.auth),
              contact_id: contact.id,
              tag_id,
              created_at: domain.now(),
              updated_at: domain.now(),
            }))
          );
      res.json({ success: true, tags: tagIds });
    } catch (cause) {
      next(cause);
    }
  }
);
module.exports = router;
