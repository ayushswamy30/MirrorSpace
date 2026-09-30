/**
 * Circle rules — kept free of database imports so they can be unit tested.
 *
 * What a person shares with their circle is deliberately tiny (report §4–5):
 * today's Inner Weather word, a "running low" signal, and seven numbers for
 * how each weekday tends to go. Nothing here ever handles words or notes.
 */
import crypto from 'node:crypto';

export const WEATHERS = ['clear', 'mild', 'overcast', 'fog', 'storm'];
export const MAX_FRIENDS = 12;
/** "Running low" is a signal for today, not a label: it clears itself. */
export const LOW_LASTS_MS = 24 * 60 * 60 * 1000;

// No 0/O or 1/I: a code has to survive being read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

export class CircleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircleValidationError';
  }
}

export function generateCode(random = crypto.randomInt) {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[random(CODE_ALPHABET.length)]).join('');
}

/** Codes are typed by hand: forgive case, spaces and dashes. */
export function normalizeCode(input) {
  if (typeof input !== 'string') throw new CircleValidationError('code must be a string');
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new CircleValidationError('That isn’t a circle code.');
  return code;
}

/** The pictures a person can show their circle: the app's own cut-outs. */
export const ICONS = [
  'bandage', 'bean', 'beetle', 'butterfly', 'can', 'cat', 'city', 'dice', 'doll', 'eye', 'heart',
  'king', 'kittens', 'lily', 'masks', 'moka', 'orchid', 'stamp', 'swallow', 'swan', 'urchin'
];

export function parseIcon(input) {
  if (input === undefined || input === null) return null;
  if (!ICONS.includes(input)) throw new CircleValidationError('unknown picture');
  return input;
}

export function parseName(input) {
  if (typeof input !== 'string') throw new CircleValidationError('name must be a string');
  const name = input.replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 24) throw new CircleValidationError('A name is 1 to 24 characters.');
  return name;
}

/**
 * The status a phone may publish. Anything beyond the weather word, its date
 * and the seven weekday numbers is rejected rather than stored.
 */
export function parseStatus(body) {
  if (!body || typeof body !== 'object') throw new CircleValidationError('status must be an object');
  const { weather = null, date = null, rhythm = null, ...rest } = body;
  if (Object.keys(rest).length) throw new CircleValidationError(`unexpected fields: ${Object.keys(rest).join(', ')}`);

  if (weather !== null && !WEATHERS.includes(weather)) throw new CircleValidationError('unknown weather');
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CircleValidationError('date must be YYYY-MM-DD');
  if (weather !== null && date === null) throw new CircleValidationError('a weather needs its date');

  if (rhythm !== null) {
    const valid =
      Array.isArray(rhythm) &&
      rhythm.length === 7 &&
      rhythm.every(v => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= -5 && v <= 5));
    if (!valid) throw new CircleValidationError('rhythm is seven numbers from -5 to 5, or null');
  }

  return {
    weather,
    weatherDate: date,
    rhythm: rhythm === null ? null : rhythm.map(v => (v === null ? null : Math.round(v * 10) / 10))
  };
}

export function isLow(lowSince, now = new Date()) {
  return Boolean(lowSince) && now.getTime() - new Date(lowSince).getTime() < LOW_LASTS_MS;
}

/**
 * Today's weather only: yesterday's is not today's news. The sharer's date is
 * trusted within a day either side, since the two phones may sit in
 * different time zones.
 */
export function currentWeather(weather, weatherDate, now = new Date()) {
  if (!weather || !weatherDate) return null;
  const age = Math.abs(now.getTime() - new Date(`${weatherDate}T12:00:00Z`).getTime());
  return age <= 36 * 60 * 60 * 1000 ? weather : null;
}

function extreme(rhythm, pick) {
  let best = null;
  rhythm.forEach((v, i) => {
    if (v === null) return;
    if (best === null || pick(v, rhythm[best])) best = i;
  });
  return best;
}

/**
 * Rhythm compatibility, in one line (report §5, "You both crash on
 * Thursdays"). Needs at least four known weekdays from each person; says
 * nothing rather than something made up.
 */
export function rhythmLine(mine, theirs, theirName) {
  const known = r => Array.isArray(r) && r.filter(v => v !== null).length >= 4;
  if (!known(mine) || !known(theirs)) return null;

  const myLow = extreme(mine, (a, b) => a < b);
  const theirLow = extreme(theirs, (a, b) => a < b);
  const myHigh = extreme(mine, (a, b) => a > b);
  const theirHigh = extreme(theirs, (a, b) => a > b);

  if (myLow === theirLow) return `You both run heavy on ${DAYS[myLow]}.`;
  if (myHigh === theirHigh) return `${DAYS[myHigh]} tend to be good for you both.`;
  return `Your heavy days fall apart — ${DAYS[myLow]} for you, ${DAYS[theirLow]} for ${theirName}. Room to check on each other.`;
}
