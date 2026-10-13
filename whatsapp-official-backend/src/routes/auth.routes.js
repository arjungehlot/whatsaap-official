const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, controller.updateMe);
module.exports = router;
