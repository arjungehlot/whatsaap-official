import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "./templates.service.js";
import { uploadAttachmentToS3 } from "./template-storage.service.js";

export async function getTemplates(req, res, next) {
  try {
    res.json({ success: true, data: { templates: await listTemplates(req.user._id, req.validated.query) } });
  } catch (error) {
    next(error);
  }
}

export async function getTemplateById(req, res, next) {
  try {
    res.json({ success: true, data: { template: await getTemplate(req.user._id, req.validated.params.id) } });
  } catch (error) {
    next(error);
  }
}

export async function postTemplate(req, res, next) {
  try {
    res.status(201).json({ success: true, data: { template: await createTemplate(req.user._id, req.validated.body) } });
  } catch (error) {
    next(error);
  }
}

export async function postTemplateAttachment(req, res, next) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Choose a file to upload" });
      return;
    }
    res.status(201).json({
      success: true,
      data: { attachment: await uploadAttachmentToS3(req.user._id, req.file) },
    });
  } catch (error) {
    next(error);
  }
}

export async function patchTemplate(req, res, next) {
  try {
    res.json({
      success: true,
      data: { template: await updateTemplate(req.user._id, req.validated.params.id, req.validated.body) },
    });
  } catch (error) {
    next(error);
  }
}

export async function postTemplateDuplicate(req, res, next) {
  try {
    res.status(201).json({
      success: true,
      data: { template: await duplicateTemplate(req.user._id, req.validated.params.id, req.validated.body) },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplateById(req, res, next) {
  try {
    await deleteTemplate(req.user._id, req.validated.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
