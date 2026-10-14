import {
  createAccount,
  disconnectAccount,
  getWhatsappLimit,
  listAccounts,
  listEvents,
  refreshAccount,
  restartPairing,
  startPairing,
  updateAccount,
} from "./whatsapp.service.js";
import { getSenderReplacementPreview } from "./sender-replacement.service.js";

export async function getSummary(req, res, next) {
  try {
    const accounts = await listAccounts(req.user._id);
    res.json({
      success: true,
      data: {
        accounts,
        limit: getWhatsappLimit(),
        used: accounts.length,
        available: Math.max(getWhatsappLimit() - accounts.length, 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAccounts(req, res, next) {
  try {
    const accounts = await listAccounts(req.user._id);
    res.json({ success: true, data: { accounts, limit: getWhatsappLimit() } });
  } catch (error) {
    next(error);
  }
}

export async function postAccount(req, res, next) {
  try {
    const account = await createAccount(req.user._id, req.validated.body);
    res.status(201).json({ success: true, data: { account, limit: getWhatsappLimit() } });
  } catch (error) {
    next(error);
  }
}

export async function patchAccount(req, res, next) {
  try {
    const account = await updateAccount(req.user._id, req.validated.params.id, req.validated.body);
    res.json({ success: true, data: { account } });
  } catch (error) {
    next(error);
  }
}

export async function getEvents(req, res, next) {
  try {
    const result = await listEvents(req.user._id, req.validated.params.id, req.validated.query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getSenderReplacement(req, res, next) {
  try {
    res.json({
      success: true,
      data: await getSenderReplacementPreview(req.user._id, req.validated.params.id),
    });
  } catch (error) {
    next(error);
  }
}

export async function postPair(req, res, next) {
  try {
    const result = await startPairing(req.user._id, req.validated.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function postRestartPairing(req, res, next) {
  try {
    const result = await restartPairing(req.user._id, req.validated.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function postDisconnect(req, res, next) {
  try {
    const account = await disconnectAccount(req.user._id, req.validated.params.id);
    res.json({ success: true, data: { account } });
  } catch (error) {
    next(error);
  }
}

export async function postRefresh(req, res, next) {
  try {
    const account = await refreshAccount(req.user._id, req.validated.params.id);
    res.json({ success: true, data: { account } });
  } catch (error) {
    next(error);
  }
}
