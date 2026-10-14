import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import {
  accountDetail,
  createGroup,
  createMessage,
  createMessageFromTemplate,
  getGroup,
  leaveGroup,
  listGroups,
  messageStatus,
  messageBatchStatus,
  updateGroupParticipants,
} from "./public-api.controller.js";
import { uploadPublicMessageFiles } from "./public-api.upload.js";
import { requireFeature } from "../billing/entitlements.service.js";
import { validate } from "../../middleware/validate.js";
import {
  createGroupSchema,
  groupDetailSchema,
  groupLeaveSchema,
  groupParticipantsSchema,
  listGroupsSchema,
} from "./public-api.groups.schemas.js";
import { messageBatchSchema } from "./public-api.message.schemas.js";

export const publicApiRouter = Router();

publicApiRouter.use(requireAuth);

publicApiRouter.get("/message/create", requireScope("messages:write"), requireFeature("api-keys"), requireFeature("send-message"), createMessage);
publicApiRouter.post("/message/create", requireScope("messages:write"), requireFeature("api-keys"), requireFeature("send-message"), uploadPublicMessageFiles.array("uploadFile", 10), createMessage);
publicApiRouter.get("/message/createFromTemplate", requireScope("messages:write"), requireFeature("api-keys"), requireFeature("template"), requireFeature("send-message"), createMessageFromTemplate);
publicApiRouter.post("/message/createFromTemplate", requireScope("messages:write"), requireFeature("api-keys"), requireFeature("template"), requireFeature("send-message"), createMessageFromTemplate);
publicApiRouter.get("/message/status", requireScope("messages:write"), messageStatus);
publicApiRouter.post("/message/status", requireScope("messages:write"), messageStatus);
publicApiRouter.get("/message/batches/:batchId", requireScope("messages:write"), validate(messageBatchSchema), messageBatchStatus);
publicApiRouter.get("/account/detail", requireScope("whatsapp:read"), accountDetail);

publicApiRouter.get("/wa/groups", requireScope("whatsapp:read"), requireFeature("api-keys"), requireFeature("inbox-groups"), validate(listGroupsSchema), listGroups);
publicApiRouter.post("/wa/groups", requireScope("whatsapp:manage"), requireFeature("api-keys"), requireFeature("inbox-groups"), validate(createGroupSchema), createGroup);
publicApiRouter.get("/wa/groups/:groupId", requireScope("whatsapp:read"), requireFeature("api-keys"), requireFeature("inbox-groups"), validate(groupDetailSchema), getGroup);
publicApiRouter.post("/wa/groups/:groupId/leave", requireScope("whatsapp:manage"), requireFeature("api-keys"), requireFeature("inbox-groups"), validate(groupLeaveSchema), leaveGroup);
publicApiRouter.post("/wa/groups/:groupId/participants", requireScope("whatsapp:manage"), requireFeature("api-keys"), requireFeature("inbox-groups"), validate(groupParticipantsSchema), updateGroupParticipants);
