const data = require('../services/data.service');
async function query(req, res, next) {
  try {
    const result = await data.query(
      req.params.collection,
      req.body || {},
      req.auth
    );
    res.json({ data: result.data, error: null, count: result.count });
  } catch (cause) {
    next(cause);
  }
}
async function create(req, res, next) {
  try {
    const body = req.body || {};
    const result = await data.create(
      req.params.collection,
      body.records,
      { select: body.select, upsert: body.upsert },
      req.auth
    );
    res.status(201).json({ data: result, error: null });
  } catch (cause) {
    next(cause);
  }
}
async function update(req, res, next) {
  try {
    const result = await data.update(
      req.params.collection,
      req.body || {},
      req.auth
    );
    res.json({ data: result, error: null });
  } catch (cause) {
    next(cause);
  }
}
async function remove(req, res, next) {
  try {
    const result = await data.remove(
      req.params.collection,
      req.body || {},
      req.auth
    );
    res.json({ data: result, error: null });
  } catch (cause) {
    next(cause);
  }
}
module.exports = { query, create, update, remove };
