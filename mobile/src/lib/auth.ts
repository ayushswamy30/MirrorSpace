import { isPreview } from './preview';
import { supabase } from './supabase';

/**
 * An account, by email — optional, and never needed to use the app.
 *
 * Lowkei starts every space anonymously. Keeping it with an email links
 * that address to the same space (nothing moves, nothing is lost); signing in
 * on another phone reaches the same account there. Either way the person
 * types a six-digit code from their inbox — no password to forget.
 *
 * Phone numbers aren't offered: every text message costs money, and the app
 * runs on free services only. What's on the phone itself (check-ins, pages,
 * Mirror) stays on that phone either way; the account carries the rest.
 */

export class AuthProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthProblem';
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

/** Plain words for what Supabase's auth errors mean to a person. */
function explain(error: { message?: string; status?: number } | null): string {
  const text = error?.message?.toLowerCase() ?? '';
  if (text.includes('rate') || error?.status === 429) return 'Too many codes asked for just now. Wait a minute, then try again.';
  if (text.includes('expired') || text.includes('invalid')) return 'That code didn’t match, or it has expired. Ask for a new one.';
  if (text.includes('already') || text.includes('registered')) return 'That email already has a Lowkei account. Sign in with it instead.';
  if (text.includes('signups not allowed') || text.includes('not found')) return 'There’s no account with that email yet.';
  return 'That didn’t go through. Check your connection and try again.';
}

/** Step one of keeping this space: a code goes to the address. */
export async function sendLinkCode(email: string): Promise<void> {
  if (isPreview) return;
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new AuthProblem(explain(error));
}

/** Step two: the code makes this space's account permanent, with that email. */
export async function confirmLinkCode(email: string, code: string): Promise<void> {
  if (isPreview) return;
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' });
  if (error) throw new AuthProblem(explain(error));
}

/** Signing in on another phone: a code to an address that has an account. */
export async function sendSignInCode(email: string): Promise<void> {
  if (isPreview) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw new AuthProblem(explain(error));
}

export async function confirmSignInCode(email: string, code: string): Promise<void> {
  if (isPreview) return;
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new AuthProblem(explain(error));
}
