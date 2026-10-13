const { getCollectionModel } = require('../models/collection.factory');
const { error } = require('../services/data.service');
const { randomUUID } = require('crypto');
async function invoke(req, res, next) {
  try {
    const p = req.body || {};
    const accountId = req.auth.account_id;
    if (req.params.name === 'filter_contacts_by_tags') {
      const rows = await getCollectionModel('contact_tags')
        .find({ account_id: accountId, tag_id: { $in: p.tag_ids || [] } })
        .lean();
      return res.json({
        data: [...new Set(rows.map((row) => row.contact_id))],
        error: null,
      });
    }
    if (req.params.name === 'touch_presence') {
      await getCollectionModel('member_presence').findOneAndUpdate(
        { account_id: accountId, user_id: req.auth.sub },
        {
          $set: {
            status: p.p_status || 'online',
            last_seen_at: new Date(),
            account_id: accountId,
            updated_at: new Date(),
          },
          $setOnInsert: { id: randomUUID(), created_at: new Date() },
        },
        { upsert: true }
      );
      return res.json({ data: null, error: null });
    }
    if (req.params.name.startsWith('increment_')) {
      const id = p.p_flow_id || p.p_automation_id;
      const table = req.params.name.includes('flow') ? 'flows' : 'automations';
      await getCollectionModel(table).updateOne(
        { id, account_id: accountId },
        { $inc: { execution_count: 1 }, $set: { updated_at: new Date() } }
      );
      return res.json({ data: null, error: null });
    }
    throw error(`RPC ${req.params.name} has not been ported`, 501);
  } catch (cause) {
    next(cause);
  }
}
module.exports = { invoke };
