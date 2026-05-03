const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { authenticateToken, validate } = require('./middleware');
const { User } = require('./models');

const router = express.Router();

const passwordField = z.string().min(8).regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain letters and numbers');

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: passwordField,
});

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: passwordField,
  role: z.enum(['Admin', 'Member']).optional(),
  adminKey: z.string().optional(),
});

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tokenVersion: user.refreshToken?.tokenHash || '',
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setAuthCookies(res, accessToken, refreshToken) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('token', accessToken, {
    httpOnly: true,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function respondWithSession(res, user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  user.refreshToken = {
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      title: user.title,
    },
  });
}

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, adminKey } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const duplicate = await User.findOne({ email: normalizedEmail });
    if (duplicate) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const shouldGrantAdmin = role === 'Admin' && adminKey && adminKey === process.env.ADMIN_INVITE_CODE;
    const isAdmin = shouldGrantAdmin;
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: isAdmin ? 'Admin' : 'Member',
      title: isAdmin ? 'Workspace admin' : 'Team member',
      avatarColor: isAdmin ? '#7C3AED' : '#5B8DEF',
    });

    return respondWithSession(res, user);
  } catch (error) {
    return next(error);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return respondWithSession(res, user);
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub).select('+refreshToken.tokenHash');

    if (!user || !user.refreshToken?.tokenHash || user.refreshToken.tokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);
    user.refreshToken = {
      tokenHash: hashToken(nextRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    await user.save();

    setAuthCookies(res, accessToken, nextRefreshToken);

    return res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id || req.user.id, { $unset: { refreshToken: 1 } });
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : 'lax';
    res.clearCookie('accessToken', { httpOnly: true, path: '/', secure, sameSite });
    res.clearCookie('token', { httpOnly: true, path: '/', secure, sameSite });
    res.clearCookie('refreshToken', { httpOnly: true, path: '/', secure, sameSite });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
