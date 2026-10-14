import { Router } from "express";
import { requireAuth, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { deleteApiKey, getApiKeys, patchApiKey, postApiKey, postRebindApiKeyReplacement } from "./api-keys.controller.js";
import { apiKeyIdSchema, createApiKeySchema, rebindApiKeyReplacementSchema, updateApiKeySchema } from "./api-keys.schemas.js";
import { requireFeature } from "../billing/entitlements.service.js";

export const apiKeysRouter = Router();

apiKeysRouter.get("/", requireAuth, requireFeature("api-keys"), getApiKeys);
apiKeysRouter.post("/", requireSessionAuth, requireFeature("api-keys"), validate(createApiKeySchema), postApiKey);
apiKeysRouter.patch("/:id", requireSessionAuth, requireFeature("api-keys"), validate(updateApiKeySchema), patchApiKey);
apiKeysRouter.post("/:id/replacement/resume", requireSessionAuth, requireFeature("api-keys"), validate(rebindApiKeyReplacementSchema), postRebindApiKeyReplacement);
apiKeysRouter.delete("/:id", requireSessionAuth, requireFeature("api-keys"), validate(apiKeyIdSchema), deleteApiKey);
