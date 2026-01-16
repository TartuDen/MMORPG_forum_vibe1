import bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (password) => {
  try {
    return await bcryptjs.hash(password, SALT_ROUNDS);
  } catch (error) {
    throw new Error('Error hashing password');
  }
};

export const comparePassword = async (password, hash) => {
  try {
    return await bcryptjs.compare(password, hash);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};
