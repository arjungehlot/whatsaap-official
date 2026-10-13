const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const { requireAuth } = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const {
  createS3Client,
  required,
  safeSegment,
  uploadObject,
} = require('../services/s3-storage.service');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024),
    files: 1,
  },
});

router.post(
  '/:bucket',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw error('A file is required');
      const folder = safeSegment(req.params.bucket, 'bucket');
      const extension = path.extname(req.file.originalname || '').slice(0, 20);
      const key = `${folder}/${safeSegment(req.auth.account_id, 'account')}/${Date.now()}-${randomUUID()}${extension}`;
      const stored = await uploadObject({
        key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
        contentDisposition: `inline; filename="${String(req.file.originalname || 'file').replace(/["\\]/g, '_')}"`,
      });
      res
        .status(201)
        .json({ data: { path: stored.key, publicUrl: stored.publicUrl }, error: null });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete('/:bucket/*key', requireAuth, async (req, res, next) => {
  try {
    const key = Array.isArray(req.params.key)
      ? req.params.key.join('/')
      : String(req.params.key || '');
    const prefix = `${safeSegment(req.params.bucket, 'bucket')}/${safeSegment(req.auth.account_id, 'account')}/`;
    if (!key.startsWith(prefix))
      throw error('File does not belong to this account', 403);
    await createS3Client().send(
      new DeleteObjectCommand({ Bucket: required('AWS_S3_BUCKET'), Key: key })
    );
    res.status(204).end();
  } catch (cause) {
    next(cause);
  }
});
module.exports = { router, uploadDir: null };
