const createRateLimiter = ({ windowMs, max, keyGenerator }) => {
  const hits = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now - entry.start > windowMs) {
        hits.delete(key);
      }
    }
  };

  return (req, res, next) => {
    cleanup();
    const key = keyGenerator(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry) {
      hits.set(key, { count: 1, start: now });
      return next();
    }

    if (now - entry.start > windowMs) {
      hits.set(key, { count: 1, start: now });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED'
      });
    }

    return next();
  };
};

const keyByIpOrUser = (req) => {
  if (req.userId) {
    return `user:${req.userId}`;
  }
  return `ip:${req.ip}`;
};

export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: keyByIpOrUser
});

export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `auth:${req.ip}`
});

export const writeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: keyByIpOrUser
});
