import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';
const JWT_ISSUER = process.env.JWT_ISSUER || 'mmorpg-forum';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mmorpg-forum-users';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is required');
}

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRE,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: String(userId)
    }
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRE,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: String(userId)
    }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  } catch (error) {
    return null;
  }
};

export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};
