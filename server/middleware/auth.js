import { verifyAccessToken } from '../config/supabaseAuth.js';
import { AuthError } from '../lib/errors.js';
import * as users from '../db/users.js';

/**
 * Authenticates a request against a Supabase Auth access token and attaches
 * this app's user row to it, provisioning that row on first sight.
 *
 * Anonymous and permanent users pass through the same path — an anonymous
 * Supabase session is a real session, just one with no identity attached yet.
 */
const auth = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    const identity = await verifyAccessToken(token);
    const user = await users.findOrProvisionByAuthUser(identity);

    // Throttled inside the repository — not a write on every request.
    users.touchLastActive(user).catch(err => {
      console.error('Failed to update last active:', err.message);
    });

    req.user = user;
    req.userId = user.id;
    req.authUserId = identity.authUserId;
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      // The reason is logged but not returned: it tells an attacker which of
      // signature, issuer, audience or expiry they got wrong.
      console.warn(`Auth rejected: ${error.message}`);
      return res.status(401).json({ message: 'Authentication failed' });
    }
    next(error);
  }
};

export default auth;
