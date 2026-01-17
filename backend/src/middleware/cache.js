const cacheStore = new Map();

const getCacheKey = (req) => {
  return `${req.originalUrl}`;
};

export const cacheResponse = (ttlMs = 30000) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = getCacheKey(req);
    const now = Date.now();
    const cached = cacheStore.get(key);

    if (cached && now - cached.timestamp < ttlMs) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cacheStore.set(key, { data, timestamp: Date.now() });
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    return next();
  };
};
