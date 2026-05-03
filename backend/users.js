const express = require('express');
const { authenticateToken, authorizeRoles } = require('./middleware');
const { User } = require('./models');

const router = express.Router();

/** List workspace users (for assigning project members). Admin only. */
router.get('/', authenticateToken, authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name email role avatarColor title')
      .sort({ name: 1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
