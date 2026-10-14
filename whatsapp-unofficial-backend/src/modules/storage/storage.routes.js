import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { uploadTemplateAttachment } from "../templates/templates.upload.js";
import { createFolder, getFile, uploadToStorage } from "./storage.controller.js";

export const storageRouter = Router();

// Retrieve file by key (public or authenticated)
storageRouter.get("/files/*", getFile);

// Creating folders and uploading files requires authentication
storageRouter.use(requireAuth);
storageRouter.post("/upload", uploadTemplateAttachment.single("file"), uploadToStorage);
storageRouter.post("/folders", createFolder);
