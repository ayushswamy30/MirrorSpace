import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import * as users from '../db/users.js';

const auth = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await users.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Throttled inside the repository — not a write on every request.
    users.touchLastActive(user).catch(err => {
      console.error('Failed to update last active:', err.message);
    });

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
    next(error);
  }
};

export default auth;
