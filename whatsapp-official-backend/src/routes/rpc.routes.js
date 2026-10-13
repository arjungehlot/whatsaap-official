const router = require('express').Router();
const { invoke } = require('../controllers/rpc.controller');
const { requireAuth } = require('../middleware/auth.middleware');
router.post('/:name', requireAuth, invoke);
module.exports = router;
