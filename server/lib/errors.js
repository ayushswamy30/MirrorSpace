/**
 * Raised when a request cannot be attributed to a valid user: no token, a
 * token that fails verification, or one whose identity no longer exists.
 * Always answered with 401 and never with a reason, since the reason tells an
 * attacker which part they got wrong.
 */
export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}
