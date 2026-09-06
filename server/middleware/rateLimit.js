import { rateLimit, ipKeyGenerator, MINUTE, HOUR } from 'express-rate-limit';

/**
 * Anyone can mint an anonymous Supabase session for free, so a user id alone
 * is not a scarce resource — the IP is the meaningful bucket for abuse. Where
 * a request is already authenticated we prefer the user id, which keeps
 * people behind one shared NAT from throttling each other.
 *
 * ipKeyGenerator normalises IPv6 to its /64 prefix; a bare req.ip would let
 * one client rotate through addresses in its own subnet.
 */
const keyByUserOrIp = req => req.userId ?? ipKeyGenerator(req.ip);

const base = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp
};

/** Blanket ceiling across the API. Generous — this is an abuse stop, not a quota. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 300,
  message: { message: 'Too many requests. Rest for a moment.' }
});

/**
 * Conversation is interactive, so the ceiling has to clear a real back and
 * forth, but each message is a paid model call.
 */
export const chatLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 60,
  message: { message: 'The mirror needs a moment. Come back shortly.' }
});

/**
 * Whole-history analysis: the most expensive call in the app, and one nobody
 * has a reason to run repeatedly.
 */
export const predictionLimiter = rateLimit({
  ...base,
  windowMs: HOUR,
  limit: 10,
  message: { message: 'That analysis was just run. Give it an hour.' }
});

/** Writes that create rows, including first-request account provisioning. */
export const writeLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 120,
  message: { message: 'Too many entries at once. Slow down.' }
});
