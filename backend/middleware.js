const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { User, Project } = require('./models');

function getAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    console.log('Auth header present');
    return authHeader.slice(7);
  }

  // Debug: log cookie keys (do not log sensitive values in production)
  try {
    const cookieKeys = Object.keys(req.cookies || {});
    if (cookieKeys.length) {
      console.log('Cookies received:', cookieKeys.join(', '));
    } else {
      console.log('No cookies received');
    }
  } catch (e) {
    console.log('Cookie parsing error', e && e.message);
  }

  return req.cookies?.accessToken;
}

async function authenticateToken(req, res, next) {
  try {
    const token = getAccessToken(req);

    if (!token) {
      console.log('No token found in header or cookies');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokenHash').lean();

    if (!user) {
      console.log('Token valid but user not found', payload.sub);
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('Token verification error:', error && error.message);
    return res.status(401).json({ error: 'Authentication required' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

async function requireProjectAccess(req, res, next) {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await Project.findById(projectId)
      .populate('members', 'name email role avatarColor')
      .populate('owner', 'name email role avatarColor')
      .lean();

    if (!project || project.archivedAt) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const canAccess = req.user.role === 'Admin'
      || String(project.owner?._id || project.owner) === String(req.user._id || req.user.id)
      || project.members.some((member) => String(member._id) === String(req.user._id || req.user.id));

    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid project access request' });
  }
}

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.flatten(),
      });
    }

    req[source] = result.data;
    next();
  };
}

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Server error' : error.message;

  res.status(statusCode).json({ error: message });
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  errorHandler,
  notFound,
  requireProjectAccess,
  validate,
};
