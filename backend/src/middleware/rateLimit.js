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

const isTestEnv = process.env.NODE_ENV === 'test';
const envLimit = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isTestEnv ? 1000 : envLimit('RATE_LIMIT_GENERAL_MAX', 120),
  keyGenerator: keyByIpOrUser
});

export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isTestEnv ? 1000 : envLimit('RATE_LIMIT_AUTH_MAX', 20),
  keyGenerator: (req) => `auth:${req.ip}`
});

export const writeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isTestEnv ? 1000 : envLimit('RATE_LIMIT_WRITE_MAX', 40),
  keyGenerator: keyByIpOrUser
});
