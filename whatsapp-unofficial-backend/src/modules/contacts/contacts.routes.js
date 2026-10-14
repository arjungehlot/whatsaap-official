import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  deleteContactById,
  downloadContactTemplate,
  deleteContactsBulk,
  getContactById,
  getContacts,
  patchContact,
  postContact,
  postContactImport,
} from "./contacts.controller.js";
import {
  bulkDeleteContactsSchema,
  contactIdSchema,
  createContactSchema,
  listContactsSchema,
  updateContactSchema,
} from "./contacts.schemas.js";
import { uploadContactFile } from "./contacts.upload.js";

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

contactsRouter.get("/", requireScope("contacts:read"), validate(listContactsSchema), getContacts);
contactsRouter.get("/import-template", requireScope("contacts:read"), downloadContactTemplate);
contactsRouter.post("/import", requireScope("contacts:write"), uploadContactFile.single("file"), postContactImport);
contactsRouter.post("/", requireScope("contacts:write"), validate(createContactSchema), postContact);
contactsRouter.delete("/", requireScope("contacts:write"), validate(bulkDeleteContactsSchema), deleteContactsBulk);
contactsRouter.get("/:id", requireScope("contacts:read"), validate(contactIdSchema), getContactById);
contactsRouter.patch("/:id", requireScope("contacts:write"), validate(updateContactSchema), patchContact);
contactsRouter.delete("/:id", requireScope("contacts:write"), validate(contactIdSchema), deleteContactById);
