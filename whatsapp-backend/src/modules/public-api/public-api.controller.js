import {
  createPublicMessage,
  createPublicMessageFromTemplate,
  getPublicMessageBatch,
  getPublicAccountDetail,
  getPublicMessageStatus,
} from "./public-api.service.js";
import {
  createPublicGroup,
  getPublicGroup,
  leavePublicGroup,
  listPublicGroups,
  updatePublicGroupParticipants,
} from "./public-api.groups.service.js";

function messageInput(req) {
  return { ...req.query, ...req.body };
}

function idempotencyKey(req) {
  const value = req.get("Idempotency-Key");
  return value ? String(value).trim() : undefined;
}

export async function createMessage(req, res, next) {
  try {
    res.json(await createPublicMessage(req.user._id, messageInput(req), req.files || [], { apiKey: req.apiKey, idempotencyKey: idempotencyKey(req) }));
  } catch (error) {
    next(error);
  }
}

export async function createMessageFromTemplate(req, res, next) {
  try {
    res.json(await createPublicMessageFromTemplate(req.user._id, messageInput(req), { apiKey: req.apiKey, idempotencyKey: idempotencyKey(req) }));
  } catch (error) {
    next(error);
  }
}

export async function messageBatchStatus(req, res, next) {
  try {
    res.json(await getPublicMessageBatch(req.user._id, req.validated.params.batchId, { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}

export async function messageStatus(req, res, next) {
  try {
    res.json(await getPublicMessageStatus(req.user._id, { ...req.query, ...req.body }));
  } catch (error) {
    next(error);
  }
}

export async function accountDetail(req, res, next) {
  try {
    res.json(await getPublicAccountDetail(req.user._id));
  } catch (error) {
    next(error);
  }
}

function groupInput(req) {
  return { ...req.validated?.query, ...req.validated?.body, ...req.validated?.params };
}

export async function listGroups(req, res, next) {
  try {
    res.json(await listPublicGroups(req.user._id, groupInput(req), { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}

export async function getGroup(req, res, next) {
  try {
    res.json(await getPublicGroup(req.user._id, groupInput(req), { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}

export async function createGroup(req, res, next) {
  try {
    res.status(201).json(await createPublicGroup(req.user._id, groupInput(req), { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}

export async function leaveGroup(req, res, next) {
  try {
    res.json(await leavePublicGroup(req.user._id, groupInput(req), { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}

export async function updateGroupParticipants(req, res, next) {
  try {
    res.json(await updatePublicGroupParticipants(req.user._id, groupInput(req), { apiKey: req.apiKey }));
  } catch (error) {
    next(error);
  }
}
