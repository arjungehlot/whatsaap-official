import {
  createWebhook,
  deleteWebhook,
  listDeliveries,
  listWebhooks,
  replayWebhookDelivery,
  sendWebhookTest,
  updateWebhook,
} from "./webhooks.service.js";

export async function getWebhooks(req, res, next) {
  try { res.json({ success: true, data: await listWebhooks(req.user._id) }); } catch (error) { next(error); }
}
export async function getWebhookDeliveries(req, res, next) {
  try { res.json({ success: true, data: await listDeliveries(req.user._id, req.validated.params.id) }); } catch (error) { next(error); }
}
export async function postWebhook(req, res, next) {
  try { res.status(201).json({ success: true, data: { endpoint: await createWebhook(req.user._id, req.validated.body) } }); } catch (error) { next(error); }
}
export async function patchWebhook(req, res, next) {
  try { res.json({ success: true, data: { endpoint: await updateWebhook(req.user._id, req.validated.params.id, req.validated.body) } }); } catch (error) { next(error); }
}
export async function deleteWebhookById(req, res, next) {
  try { await deleteWebhook(req.user._id, req.validated.params.id); res.status(204).send(); } catch (error) { next(error); }
}
export async function postWebhookTest(req, res, next) {
  try { res.json({ success: true, data: { delivery: await sendWebhookTest(req.user._id, req.validated.params.id) } }); } catch (error) { next(error); }
}
export async function postWebhookReplay(req, res, next) {
  try { res.json({ success: true, data: { delivery: await replayWebhookDelivery(req.user._id, req.validated.params.id) } }); } catch (error) { next(error); }
}
