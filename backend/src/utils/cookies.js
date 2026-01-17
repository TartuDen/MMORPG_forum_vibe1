export const parseCookies = (cookieHeader = '') => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    const value = rawValue.join('=');
    acc[rawKey] = decodeURIComponent(value);
    return acc;
  }, {});
};
