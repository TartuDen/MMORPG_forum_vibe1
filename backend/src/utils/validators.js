export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUsername = (username) => {
  // Username: 3-20 characters, alphanumeric and underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validatePassword = (password) => {
  // Password: at least 8 characters, must contain uppercase, lowercase, number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

export const sanitizeUser = (user) => {
  const { password_hash, ...sanitized } = user;
  return sanitized;
};

export const parseImageDataUrl = (dataUrl, maxBytes) => {
  if (!dataUrl) return { dataUrl: null, mime: null };
  if (typeof dataUrl !== 'string') {
    throw { status: 400, message: 'Invalid image data', code: 'INVALID_IMAGE' };
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) {
    throw { status: 400, message: 'Invalid image data', code: 'INVALID_IMAGE' };
  }

  const base64 = match[2];
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    throw { status: 400, message: 'Invalid image data', code: 'INVALID_IMAGE' };
  }

  if (buffer.length > maxBytes) {
    throw { status: 400, message: 'Image too large', code: 'IMAGE_TOO_LARGE' };
  }

  return { dataUrl, mime: match[1] };
};
