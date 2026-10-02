import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function verifyToken(req, res, next) {
  const authorization = req.get('authorization') ?? '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'A valid access token is required.' },
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
    if (payload.tokenUse !== 'access' || !payload.sub) throw new Error('Invalid token');
    const user = await User.findById(payload.sub).select('role isActive');
    if (!user?.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_ACCESS_TOKEN', message: 'The access token is invalid or expired.' },
      });
    }
    req.user = { id: user.id, role: user.role };
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError' && error.message !== 'Invalid token') {
      return next(error);
    }
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_ACCESS_TOKEN', message: 'The access token is invalid or expired.' },
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' },
      });
    }
    return next();
  };
}
