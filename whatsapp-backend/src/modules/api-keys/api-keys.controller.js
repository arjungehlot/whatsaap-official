import { createApiKey, listApiKeys, rebindApiKeyToReplacement, revokeApiKey, updateApiKey } from "./api-keys.service.js";

export async function getApiKeys(req, res, next) {
  try {
    // An integration key may inspect only itself; a browser session can manage the full key list.
    const onlyKeyId = req.authType === "api-key" ? req.apiKey?._id : undefined;
    res.json({ success: true, data: { keys: await listApiKeys(req.user._id, onlyKeyId) } });
  } catch (error) {
    next(error);
  }
}

export async function postApiKey(req, res, next) {
  try {
    res.status(201).json({ success: true, data: { key: await createApiKey(req.user._id, req.validated.body) } });
  } catch (error) {
    next(error);
  }
}

export async function patchApiKey(req, res, next) {
  try {
    res.json({ success: true, data: { key: await updateApiKey(req.user._id, req.validated.params.id, req.validated.body) } });
  } catch (error) {
    next(error);
  }
}

export async function deleteApiKey(req, res, next) {
  try {
    await revokeApiKey(req.user._id, req.validated.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function postRebindApiKeyReplacement(req, res, next) {
  try {
    res.json({
      success: true,
      data: await rebindApiKeyToReplacement(req.user._id, req.validated.params.id),
    });
  } catch (error) {
    next(error);
  }
}
