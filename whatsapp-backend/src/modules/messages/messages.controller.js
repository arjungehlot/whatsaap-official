import { sendApiMessage } from "./messages.service.js";

export async function postMessage(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await sendApiMessage(req.user._id, req.validated.body, { apiKey: req.apiKey }) });
  } catch (error) {
    next(error);
  }
}
