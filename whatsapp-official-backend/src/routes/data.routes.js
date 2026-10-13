const router = require('express').Router();
const controller = require('../controllers/data.controller');
const { requireAuth, requireWriter } = require('../middleware/auth.middleware');
router.post('/:collection/query', requireAuth, controller.query);
router.post('/:collection', requireAuth, requireWriter, controller.create);
router.patch('/:collection', requireAuth, requireWriter, controller.update);
router.delete('/:collection', requireAuth, requireWriter, controller.remove);
module.exports = router;
