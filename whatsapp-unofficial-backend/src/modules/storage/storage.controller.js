import { createFolderInBucket, downloadFileByKey, uploadFileToFolder } from "../templates/template-storage.service.js";

export async function uploadToStorage(req, res, next) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Choose a file to upload" });
      return;
    }
    const folder = req.body.folder || req.query.folder || "documents/whatsapp/uploads";
    const uploaded = await uploadFileToFolder({
      folder,
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    res.status(201).json({ success: true, data: uploaded });
  } catch (error) {
    next(error);
  }
}

export async function createFolder(req, res, next) {
  try {
    const folder = req.body.folder || req.body.folderPath;
    const result = await createFolderInBucket(folder);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getFile(req, res, next) {
  try {
    const rawKey = req.params[0] || req.query.key;
    const key = decodeURIComponent(rawKey);
    const file = await downloadFileByKey(key);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.size);
    res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
}
