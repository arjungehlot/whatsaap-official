const router = require('express').Router();
const { requireAuth, requireWriter } = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');

function payload(body) {
  const title = domain.assertString(body?.title, 'title', 120);
  const kind = body?.kind === 'interactive' ? 'interactive' : 'text';
  if (kind === 'text') {
    const content_text = domain.assertString(
      body?.content_text,
      'content_text',
      4096
    );
    return { title, kind, content_text, interactive_payload: null };
  }
  if (
    !body?.interactive_payload ||
    typeof body.interactive_payload !== 'object'
  ) {
    throw error(
      'interactive_payload is required for an interactive quick reply'
    );
  }
  return {
    title,
    kind,
    content_text: null,
    interactive_payload: body.interactive_payload,
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json({ quick_replies: await domain.many('quick_replies', req.auth) });
  } catch (cause) {
    next(cause);
  }
});
router.post('/', requireAuth, requireWriter, async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        quick_reply: await domain.insert('quick_replies', req.auth, {
          ...payload(req.body),
          user_id: domain.userId(req.auth),
        }),
      });
  } catch (cause) {
    next(cause);
  }
});
router.patch('/:id', requireAuth, requireWriter, async (req, res, next) => {
  try {
    const row = await domain.updateOne(
      'quick_replies',
      req.auth,
      req.params.id,
      payload(req.body)
    );
    if (!row) throw error('Quick reply not found', 404);
    res.json({ quick_reply: row });
  } catch (cause) {
    next(cause);
  }
});
router.delete('/:id', requireAuth, requireWriter, async (req, res, next) => {
  try {
    if (!(await domain.removeOne('quick_replies', req.auth, req.params.id)))
      throw error('Quick reply not found', 404);
    res.json({ success: true });
  } catch (cause) {
    next(cause);
  }
});
module.exports = router;
