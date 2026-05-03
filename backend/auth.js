const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { authenticateToken, validate } = require('./middleware');
const { sendSignupOtpEmail } = require('./mailer');
const { SignupVerification, User } = require('./models');

const router = express.Router();

const passwordField = z.string().min(8).regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain letters and numbers');

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: passwordField,
});

const signupSendOtpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: passwordField,
  role: z.enum(['Admin', 'Member']).optional(),
  adminKey: z.string().optional(),
});

const signupVerifySchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
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

function hashOtp(email, otp) {
  const secret = process.env.OTP_PEPPER || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET or OTP_PEPPER must be set');
  }
  return crypto.createHmac('sha256', secret).update(`${email.toLowerCase().trim()}:${otp}`).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
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

/** Step 1: validate input, store hashed password + OTP, send email */
router.post('/signup/send-otp', validate(signupSendOtpSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, adminKey } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const shouldGrantAdmin = role === 'Admin' && adminKey && adminKey === process.env.ADMIN_INVITE_CODE;
    const intendedRole = shouldGrantAdmin ? 'Admin' : 'Member';

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpHash = hashOtp(normalizedEmail, otp);

    await SignupVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        intendedRole,
        otpHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendSignupOtpEmail(normalizedEmail, otp, name.trim());
    try {
      await sendSignupOtpEmail(normalizedEmail, otp, name.trim());
    } catch (mailError) {
      // Log and return a 502 indicating email delivery failed
      console.error('Failed to send signup OTP email:', mailError && (mailError.message || mailError));
      return res.status(502).json({ error: 'Unable to send verification email. Please try again later.' });
    }

    return res.json({
      message: 'Verification code sent to your email',
      email: normalizedEmail,
    });
  } catch (error) {
    return next(error);
  }
});

/** Step 2: verify OTP and create the user account */
router.post('/signup/verify', validate(signupVerifySchema), async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const pending = await SignupVerification.findOne({ email: normalizedEmail }).select('+passwordHash +otpHash');
    if (!pending) {
      return res.status(400).json({ error: 'No pending signup for this email. Request a new code.' });
    }

    if (pending.expiresAt < new Date()) {
      await SignupVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({ error: 'Verification code expired. Sign up again.' });
    }

    const maxAttempts = 8;
    if (pending.attempts >= maxAttempts) {
      await SignupVerification.deleteOne({ _id: pending._id });
      return res.status(429).json({ error: 'Too many attempts. Start signup again.' });
    }

    const expectedHash = hashOtp(normalizedEmail, otp);
    let otpMatches = false;
    try {
      const a = Buffer.from(pending.otpHash, 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length === b.length && a.length > 0) {
        otpMatches = crypto.timingSafeEqual(a, b);
      }
    } catch {
      otpMatches = false;
    }

    if (!otpMatches) {
      pending.attempts += 1;
      await pending.save();
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const duplicate = await User.findOne({ email: normalizedEmail });
    if (duplicate) {
      await SignupVerification.deleteOne({ _id: pending._id });
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const isAdmin = pending.intendedRole === 'Admin';
    const user = await User.create({
      name: pending.name,
      email: normalizedEmail,
      passwordHash: pending.passwordHash,
      role: isAdmin ? 'Admin' : 'Member',
      title: isAdmin ? 'Workspace admin' : 'Team member',
      avatarColor: isAdmin ? '#7C3AED' : '#5B8DEF',
    });

    await SignupVerification.deleteOne({ _id: pending._id });

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
