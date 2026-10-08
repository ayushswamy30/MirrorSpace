import { allCheckIns, localDate, type CheckIn } from './checkIns';
import { kv } from './db/kv';
import { weatherOf } from './patterns';
import { allSleep, formatClock, type SleepLog } from './sleep';

/**
 * The Mind Chart (report §5, day 14): the person's placements, drawn from
 * their own last ninety days — when their nights sit, the hours that run
 * lightest, how heavy days show up, what drains and what restores, how fast
 * the lighter days come back, and whether people charge or spend them.
 *
 * Like patterns.ts: every placement carries its evidence and needs a minimum
 * of it, and says "tended to", never "because". Until there is enough, a
 * placement says what it is still waiting for. Computed on the phone; nothing
 * here is sent anywhere.
 *
 * Drawn once a month, like a chart is: the drawing date is kept, and the
 * chart is redrawn thirty days later — or sooner while any placement is
 * still waiting, so a thin first chart fills in as the days come.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 90;
export const REDRAW_DAYS = 30;

const MIN_NIGHTS = 5;
const MIN_PER_HOUR_BUCKET = 3;
const MIN_HEAVY = 4;
const MIN_TAG_USES = 3;
const TAG_GAP = 1.5;
const MIN_STRETCHES = 2;
const MIN_SOCIAL = 3;
const SOCIAL_GAP = 1;

const PEOPLE = ['family', 'partner', 'friends'];

export type Placement = {
  /** The serif value — "Night owl", "Mornings". Null while still waiting. */
  value: string | null;
  /** One sentence in the reading's voice, or what it is still waiting for. */
  line: string;
  /** The evidence, as a data line. Empty while still waiting. */
  receipt: string;
};

export type TagLean = { tag: string; gap: number; count: number };

export type MindChart = {
  drawnAt: string;
  rhythm: Placement;
  hours: Placement;
  stress: Placement;
  /** Tags whose check-ins ran lighter than the rest, strongest first. */
  restorers: TagLean[];
  /** Tags whose check-ins ran heavier than the rest, strongest first. */
  drains: TagLean[];
  recovery: Placement;
  social: Placement;
  /** Every placement found; a complete chart waits a month to be redrawn. */
  complete: boolean;
};

function waiting(line: string): Placement {
  return { value: null, line, receipt: '' };
}

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;
}

function more(n: number, one: string, many: string): string {
  return `${n} more ${n === 1 ? one : many}`;
}

/** Minutes past midnight, counted from noon so a night doesn't wrap: 23:00 is −60. */
function clockAround(iso: string): number {
  const d = new Date(iso);
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 12 * 60 ? m - 1440 : m;
}

function clock(around: number): string {
  return formatClock(Math.round(((around % 1440) + 1440) % 1440));
}

// ---------------------------------------------------------------------------
// When the nights sit

const EARLY_BEFORE = 3 * 60;
const LATE_AFTER = 4 * 60 + 30;

export function rhythm(sleep: readonly SleepLog[]): Placement {
  if (sleep.length < MIN_NIGHTS) {
    return waiting(`Needs ${more(MIN_NIGHTS - sleep.length, 'night', 'nights')} of sleep logged.`);
  }
  const bed = median(sleep.map(l => clockAround(l.bedAt)));
  const wake = median(sleep.map(l => clockAround(l.wakeAt)));
  const mid = median(sleep.map(l => clockAround(l.bedAt) + l.minutes / 2));
  const receipt = `midpoint ${clock(mid)} · asleep ~${clock(bed)} · up ~${clock(wake)} · ${sleep.length} nights`;

  if (mid < EARLY_BEFORE) {
    return { value: 'Early riser', line: `Your nights sit early — asleep around ${clock(bed)}, up around ${clock(wake)}.`, receipt };
  }
  if (mid > LATE_AFTER) {
    return { value: 'Night owl', line: `Your nights run late — asleep around ${clock(bed)}, up around ${clock(wake)}.`, receipt };
  }
  return { value: 'In between', line: `Your nights sit in the middle — asleep around ${clock(bed)}, up around ${clock(wake)}.`, receipt };
}

// ---------------------------------------------------------------------------
// The hours that run lightest

const BUCKETS = [
  { key: 'mornings', from: 5, to: 12, at: 'in the morning' },
  { key: 'afternoons', from: 12, to: 17, at: 'in the afternoon' },
  { key: 'evenings', from: 17, to: 22, at: 'in the evening' },
  { key: 'nights', from: 22, to: 29, at: 'late at night' }
] as const;

function bucketOf(iso: string): (typeof BUCKETS)[number] {
  const h = new Date(iso).getHours();
  const hour = h < 5 ? h + 24 : h;
  return BUCKETS.find(b => hour >= b.from && hour < b.to) ?? BUCKETS[3];
}

export function hours(checkIns: readonly CheckIn[]): Placement {
  const rows = BUCKETS.map(b => {
    const list = checkIns.filter(c => bucketOf(c.createdAt).key === b.key);
    return { ...b, count: list.length, mood: list.length ? mean(list.map(c => c.pleasantness)) : 0 };
  }).filter(r => r.count >= MIN_PER_HOUR_BUCKET);

  if (rows.length < 2) {
    return waiting('Needs a few check-ins at different times of day — morning, afternoon, evening.');
  }
  const sorted = [...rows].sort((a, b) => b.mood - a.mood);
  const light = sorted[0];
  const heavy = sorted[sorted.length - 1];
  const value = light.key[0].toUpperCase() + light.key.slice(1);
  return {
    value,
    line:
      light.mood - heavy.mood < 1
        ? `Check-ins have run about the same through the day, a touch lighter ${light.at}.`
        : `Check-ins have run lightest ${light.at}, and heaviest ${heavy.at}.`,
    receipt: rows.map(r => `${r.key} ${signed(r.mood)} (${r.count})`).join(' · ')
  };
}

// ---------------------------------------------------------------------------
// How heavy days show up

export function stress(checkIns: readonly CheckIn[]): Placement {
  const heavy = checkIns.filter(c => c.pleasantness < 0);
  if (heavy.length < MIN_HEAVY) {
    // Not having enough heavy days is not something to wait for.
    return waiting(
      checkIns.length >= MIN_HEAVY * 3
        ? 'Few heavy check-ins so far — not enough to say how they tend to show up.'
        : `Needs ${more(MIN_HEAVY * 3 - checkIns.length, 'check-in', 'check-ins')}.`
    );
  }
  const charged = heavy.filter(c => c.energy > 0).length;
  const share = charged / heavy.length;
  const counts = new Map<string, number>();
  for (const c of heavy) counts.set(c.emotion, (counts.get(c.emotion) ?? 0) + 1);
  const words = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([w]) => w);
  const receipt = `${charged} of ${heavy.length} heavy check-ins charged · ${words.join(', ')}`;

  if (share >= 0.6) return { value: 'Storm', line: 'When it’s heavy, it tends to run hot — charged more than flat.', receipt };
  if (share <= 0.4) return { value: 'Fog', line: 'When it’s heavy, it tends to go quiet — flat more than charged.', receipt };
  return { value: 'Both', line: 'Heavy days have come both ways — some charged, some flat.', receipt };
}

// ---------------------------------------------------------------------------
// What drains, what restores

export function leans(checkIns: readonly CheckIn[]): { restorers: TagLean[]; drains: TagLean[] } {
  const tags = new Set(checkIns.flatMap(c => c.tags));
  const found: TagLean[] = [];
  for (const tag of tags) {
    const tagged = checkIns.filter(c => c.tags.includes(tag));
    const others = checkIns.filter(c => !c.tags.includes(tag));
    if (tagged.length < MIN_TAG_USES || others.length < MIN_TAG_USES) continue;
    const gap = mean(tagged.map(c => c.pleasantness)) - mean(others.map(c => c.pleasantness));
    if (Math.abs(gap) >= TAG_GAP) found.push({ tag, gap, count: tagged.length });
  }
  return {
    restorers: found.filter(f => f.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3),
    drains: found.filter(f => f.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 3)
  };
}

// ---------------------------------------------------------------------------
// How fast the lighter days come back

const HEAVY = new Set(['fog', 'storm']);
const LIGHT = new Set(['clear', 'mild']);

/**
 * Each heavy stretch, from its first heavy day to the next light one, in
 * calendar days — quiet days in between count, they are still days. A
 * stretch not yet over isn't counted.
 */
export function recoveries(checkIns: readonly CheckIn[], from: Date, to: Date): number[] {
  const byDate = new Map<string, CheckIn[]>();
  for (const c of checkIns) byDate.set(c.localDate, [...(byDate.get(c.localDate) ?? []), c]);

  const out: number[] = [];
  let start: number | null = null;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; day <= to; i++, day.setDate(day.getDate() + 1)) {
    const weather = weatherOf(byDate.get(localDate(day)) ?? []);
    if (!weather) continue;
    if (HEAVY.has(weather) && start === null) start = i;
    else if (LIGHT.has(weather) && start !== null) {
      out.push(i - start);
      start = null;
    }
  }
  return out;
}

export function recovery(checkIns: readonly CheckIn[], from: Date, to: Date): Placement {
  const found = recoveries(checkIns, from, to);
  if (found.length < MIN_STRETCHES) {
    return waiting(
      found.length === 0
        ? 'Needs a heavier day or two, and the lighter ones after — this one fills in with time.'
        : 'Needs one more heavy stretch, and the lighter day after it.'
    );
  }
  const typical = Math.round(median(found));
  return {
    value: typical <= 1 ? 'Within a day' : `About ${typical} days`,
    line:
      typical <= 1
        ? 'After a heavy day, a lighter one has tended to come the next day.'
        : `After a heavy day, a lighter one has tended to come within ${typical} days.`,
    receipt: `${found.length} heavy stretches · lighter again after ${found.join(', ')} days`
  };
}

// ---------------------------------------------------------------------------
// People, or alone

export function social(checkIns: readonly CheckIn[]): Placement {
  const withPeople = checkIns.filter(c => c.tags.some(t => PEOPLE.includes(t)));
  const alone = checkIns.filter(c => c.tags.includes('alone') && !c.tags.some(t => PEOPLE.includes(t)));
  if (withPeople.length < MIN_SOCIAL || alone.length < MIN_SOCIAL) {
    const need = Math.max(0, MIN_SOCIAL - withPeople.length) + Math.max(0, MIN_SOCIAL - alone.length);
    return waiting(`Needs ${more(need, 'check-in', 'check-ins')} tagged with people, or “alone”.`);
  }
  const people = mean(withPeople.map(c => c.pleasantness));
  const own = mean(alone.map(c => c.pleasantness));
  const receipt = `with people ${signed(people)} (${withPeople.length}) · alone ${signed(own)} (${alone.length})`;
  if (people - own >= SOCIAL_GAP) {
    return { value: 'Charged by people', line: 'Check-ins with people in them have run lighter than ones alone.', receipt };
  }
  if (own - people >= SOCIAL_GAP) {
    return { value: 'Recharges alone', line: 'Time alone has run lighter than time with people.', receipt };
  }
  return { value: 'Even', line: 'With people or alone, check-ins have run about the same.', receipt };
}

// ---------------------------------------------------------------------------
// The chart

export function drawMindChart(checkIns: readonly CheckIn[], sleep: readonly SleepLog[], asOf: Date): MindChart {
  const from = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - (WINDOW_DAYS - 1));
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= asOf.getTime();
  };
  const recent = checkIns.filter(c => inWindow(c.createdAt));
  const nights = sleep.filter(l => inWindow(l.wakeAt));

  const chart = {
    drawnAt: asOf.toISOString(),
    rhythm: rhythm(nights),
    hours: hours(recent),
    stress: stress(recent),
    ...leans(recent),
    recovery: recovery(recent, from, asOf),
    social: social(recent)
  };
  const placements = [chart.rhythm, chart.hours, chart.stress, chart.recovery, chart.social];
  return {
    ...chart,
    complete: placements.every(p => p.value !== null) && chart.restorers.length + chart.drains.length > 0
  };
}

/** Whether a chart drawn at `drawnAt` should be drawn again now. */
export function needsRedraw(chart: MindChart, now: Date): boolean {
  const age = now.getTime() - new Date(chart.drawnAt).getTime();
  return !chart.complete || age < 0 || age >= REDRAW_DAYS * DAY_MS;
}

const DRAWN_AT = 'mindChart.drawnAt';

/** The chart as it stands: last month's drawing, or a fresh one when it's due. */
export async function currentMindChart(now: Date = new Date()): Promise<MindChart> {
  const [checkIns, sleep, stored] = await Promise.all([allCheckIns(), allSleep(), kv.get(DRAWN_AT)]);
  if (stored) {
    const kept = drawMindChart(checkIns, sleep, new Date(stored));
    if (!needsRedraw(kept, now)) return kept;
  }
  const fresh = drawMindChart(checkIns, sleep, now);
  await kv.set(DRAWN_AT, fresh.drawnAt);
  return fresh;
}
