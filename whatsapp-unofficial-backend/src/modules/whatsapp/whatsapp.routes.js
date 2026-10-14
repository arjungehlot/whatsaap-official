import { Router } from "express";
import { requireAuth, requireScope, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getAccounts,
  getEvents,
  getSenderReplacement,
  getSummary,
  patchAccount,
  postAccount,
  postDisconnect,
  postPair,
  postRestartPairing,
  postRefresh,
} from "./whatsapp.controller.js";
import { accountIdSchema, createAccountSchema, disconnectAccountSchema, listEventsSchema, updateAccountSchema } from "./whatsapp.schemas.js";

export const whatsappRouter = Router();

whatsappRouter.use(requireAuth);

whatsappRouter.get("/summary", requireScope("whatsapp:read"), getSummary);
whatsappRouter.get("/accounts", requireScope("whatsapp:read"), getAccounts);
whatsappRouter.post("/accounts", requireSessionAuth, validate(createAccountSchema), postAccount);
whatsappRouter.patch("/accounts/:id", requireSessionAuth, validate(updateAccountSchema), patchAccount);
whatsappRouter.get("/accounts/:id/events", requireScope("whatsapp:read"), validate(listEventsSchema), getEvents);
whatsappRouter.get("/accounts/:id/sender-replacement", requireSessionAuth, validate(accountIdSchema), getSenderReplacement);
whatsappRouter.post("/accounts/:id/pair", requireSessionAuth, validate(accountIdSchema), postPair);
whatsappRouter.post("/accounts/:id/restart-pairing", requireSessionAuth, validate(accountIdSchema), postRestartPairing);
whatsappRouter.post("/accounts/:id/disconnect", requireSessionAuth, validate(disconnectAccountSchema), postDisconnect);
whatsappRouter.post("/accounts/:id/refresh", requireSessionAuth, validate(accountIdSchema), postRefresh);
