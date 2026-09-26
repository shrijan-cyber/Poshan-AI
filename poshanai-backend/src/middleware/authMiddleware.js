import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
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
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
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
