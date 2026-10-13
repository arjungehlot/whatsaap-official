const router = require('express').Router();
const { randomUUID } = require('crypto');
const { requireAuth, requireWriter } = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');

function nodesFrom(body) {
  if (body?.nodes === undefined) return undefined;
  if (!Array.isArray(body.nodes)) throw error('nodes must be an array');
  return body.nodes.map((node, index) => {
    if (!node || typeof node !== 'object' || typeof node.node_type !== 'string')
      throw error(`nodes[${index}].node_type is required`);
    return {
      node_key:
        typeof node.node_key === 'string' ? node.node_key : randomUUID(),
      node_type: node.node_type,
      config: node.config || {},
      position: node.position || null,
    };
  });
}

async function replaceChildren(
  collection,
  parentKey,
  parentId,
  auth,
  children
) {
  if (children === undefined) return;
  await domain
    .model(collection)
    .deleteMany({ account_id: domain.accountId(auth), [parentKey]: parentId });
  if (children.length)
    await domain
      .model(collection)
      .insertMany(
        children.map((child) => ({
          ...child,
          id: child.id || randomUUID(),
          account_id: domain.accountId(auth),
          [parentKey]: parentId,
          created_at: domain.now(),
          updated_at: domain.now(),
        }))
      );
}

router.get('/flows/templates', requireAuth, (_req, res) =>
  res.json({ templates: [] })
);
router.get('/flows', requireAuth, async (req, res, next) => {
  try {
    res.json({ flows: await domain.many('flows', req.auth) });
  } catch (cause) {
    next(cause);
  }
});
router.post('/flows', requireAuth, requireWriter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = domain.assertString(body.name, 'name', 160);
    const nodes = nodesFrom(body);
    const flow = await domain.insert('flows', req.auth, {
      user_id: domain.userId(req.auth),
      name,
      description: body.description || null,
      status: 'draft',
      trigger_type: body.trigger_type || 'keyword',
      trigger_config: body.trigger_config || {},
      entry_node_id: body.entry_node_id || null,
    });
    await replaceChildren('flow_nodes', 'flow_id', flow.id, req.auth, nodes);
    res.status(201).json({ flow });
  } catch (cause) {
    next(cause);
  }
});
router.get('/flows/:id/runs', requireAuth, async (req, res, next) => {
  try {
    const flow = await domain.one('flows', req.auth, { id: req.params.id });
    if (!flow) throw error('Flow not found', 404);
    res.json({
      runs: await domain.many('flow_runs', req.auth, { flow_id: flow.id }),
    });
  } catch (cause) {
    next(cause);
  }
});
router.post(
  '/flows/:id/activate',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const flow = await domain.updateOne('flows', req.auth, req.params.id, {
        status: req.body?.active === false ? 'draft' : 'active',
      });
      if (!flow) throw error('Flow not found', 404);
      res.json({ flow });
    } catch (cause) {
      next(cause);
    }
  }
);
router.get('/flows/:id', requireAuth, async (req, res, next) => {
  try {
    const flow = await domain.one('flows', req.auth, { id: req.params.id });
    if (!flow) throw error('Flow not found', 404);
    const nodes = await domain.many(
      'flow_nodes',
      req.auth,
      { flow_id: flow.id },
      { created_at: 1 }
    );
    res.json({ flow, nodes });
  } catch (cause) {
    next(cause);
  }
});
router.patch(
  '/flows/:id',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const nodes = nodesFrom(body);
      const values = {};
      for (const key of [
        'name',
        'description',
        'trigger_type',
        'trigger_config',
        'entry_node_id',
        'status',
      ])
        if (key in body) values[key] = body[key];
      if ('name' in values)
        values.name = domain.assertString(values.name, 'name', 160);
      const flow = await domain.updateOne(
        'flows',
        req.auth,
        req.params.id,
        values
      );
      if (!flow) throw error('Flow not found', 404);
      await replaceChildren('flow_nodes', 'flow_id', flow.id, req.auth, nodes);
      res.json({ flow });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/flows/:id',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const row = await domain.removeOne('flows', req.auth, req.params.id);
      if (!row) throw error('Flow not found', 404);
      await domain
        .model('flow_nodes')
        .deleteMany({
          account_id: domain.accountId(req.auth),
          flow_id: row.id,
        });
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);

router.get('/automations', requireAuth, async (req, res, next) => {
  try {
    res.json({ automations: await domain.many('automations', req.auth) });
  } catch (cause) {
    next(cause);
  }
});
router.post(
  '/automations',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const name = domain.assertString(body.name, 'name', 160);
      const automation = await domain.insert('automations', req.auth, {
        user_id: domain.userId(req.auth),
        name,
        description: body.description || null,
        trigger_type: domain.assertString(
          body.trigger_type,
          'trigger_type',
          80
        ),
        trigger_config: body.trigger_config || {},
        is_active: Boolean(body.is_active),
      });
      const steps = Array.isArray(body.steps) ? body.steps : [];
      await replaceChildren(
        'automation_steps',
        'automation_id',
        automation.id,
        req.auth,
        steps.map((step, index) => ({
          ...step,
          step_order: step.step_order ?? index,
        }))
      );
      res.status(201).json({ automation });
    } catch (cause) {
      next(cause);
    }
  }
);
router.get('/automations/:id', requireAuth, async (req, res, next) => {
  try {
    const automation = await domain.one('automations', req.auth, {
      id: req.params.id,
    });
    if (!automation) throw error('Automation not found', 404);
    res.json({
      automation,
      steps: await domain.many(
        'automation_steps',
        req.auth,
        { automation_id: automation.id },
        { step_order: 1, created_at: 1 }
      ),
    });
  } catch (cause) {
    next(cause);
  }
});
router.patch(
  '/automations/:id',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const values = {};
      for (const key of [
        'name',
        'description',
        'trigger_type',
        'trigger_config',
        'is_active',
      ])
        if (key in body) values[key] = body[key];
      if ('name' in values)
        values.name = domain.assertString(values.name, 'name', 160);
      const automation = await domain.updateOne(
        'automations',
        req.auth,
        req.params.id,
        values
      );
      if (!automation) throw error('Automation not found', 404);
      if ('steps' in body) {
        if (!Array.isArray(body.steps)) throw error('steps must be an array');
        await replaceChildren(
          'automation_steps',
          'automation_id',
          automation.id,
          req.auth,
          body.steps.map((step, index) => ({
            ...step,
            step_order: step.step_order ?? index,
          }))
        );
      }
      res.json({ automation });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/automations/:id',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const row = await domain.removeOne(
        'automations',
        req.auth,
        req.params.id
      );
      if (!row) throw error('Automation not found', 404);
      await domain
        .model('automation_steps')
        .deleteMany({
          account_id: domain.accountId(req.auth),
          automation_id: row.id,
        });
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/automations/:id/duplicate',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const source = await domain.one('automations', req.auth, {
        id: req.params.id,
      });
      if (!source) throw error('Automation not found', 404);
      const automation = await domain.insert('automations', req.auth, {
        ...source,
        id: undefined,
        name: `${source.name} (copy)`,
        is_active: false,
        user_id: domain.userId(req.auth),
      });
      const steps = await domain.many(
        'automation_steps',
        req.auth,
        { automation_id: source.id },
        { step_order: 1 }
      );
      await replaceChildren(
        'automation_steps',
        'automation_id',
        automation.id,
        req.auth,
        steps.map(
          ({ id, automation_id, created_at, updated_at, ...step }) => step
        )
      );
      res.status(201).json({ automation });
    } catch (cause) {
      next(cause);
    }
  }
);
module.exports = router;
