const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'team-task-manager-api' });
});

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/projects', require('./projects'));
router.use('/tasks', require('./tasks'));
router.use('/dashboard', require('./dashboard'));

module.exports = router;
