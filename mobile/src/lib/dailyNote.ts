import { allCheckIns, localDate } from './checkIns';
import { kv } from './db/kv';
import { today } from './patterns';
import { allSleep } from './sleep';
import { listVents } from './vents';

/**
 * The daily note: at 11:11 in the person's own time, a short reflection or a
 * heads-up for the day — the day's reading headline, and one line under it.
 *
 * It is written on the phone, from the same reading as Today (reading.ts), so
 * the note and the page agree. Notes for the week ahead are written at once
 * and handed over together (to the system on a phone, to the server for the
 * web app), so they keep coming on days the app isn't opened; each is
 * rewritten whenever the app opens or something new is checked in.
 *
 * What a note may say is the reading's `note`: what the day is about, never a
 * feeling word someone chose or anything they wrote.
 */

/** 11:11, as minutes after midnight. */
export const NOTE_TIME = 11 * 60 + 11;
const DAYS_AHEAD = 7;
const ENABLED_KEY = 'daily.enabled';

export type DailyNote = { at: Date; title: string; body: string };

/** Whose notes, and whether readings may be personal — set by ReminderSync from the profile. */
let context = { personal: false, seed: '' };

export function setNoteContext(next: { personal: boolean; seed: string }): void {
  context = next;
}

/** On unless switched off; whether notifications are allowed is asked elsewhere. */
export async function dailyNoteWanted(): Promise<boolean> {
  return (await kv.get(ENABLED_KEY)) !== '0';
}

export async function saveDailyNote(on: boolean): Promise<void> {
  await kv.set(ENABLED_KEY, on ? '1' : '0');
}

/** The next `days` 11:11s still ahead of `now`, in local time. */
export function noteTimes(now: Date = new Date(), days = DAYS_AHEAD): Date[] {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, NOTE_TIME);
  const start = first.getTime() > now.getTime() ? 0 : 1;
  return Array.from({ length: days }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + start + i, 0, NOTE_TIME));
}

async function sources() {
  const [checkIns, sleep, pages] = await Promise.all([
    allCheckIns(),
    allSleep().catch(() => []),
    context.personal ? listVents(30).catch(() => []) : Promise.resolve([])
  ]);
  return { checkIns, sleep, pages };
}

function noteFor(at: Date, data: Awaited<ReturnType<typeof sources>>): DailyNote {
  const { reading } = today(data.checkIns, {
    personal: context.personal,
    todayDate: localDate(at),
    now: at,
    sleep: data.sleep,
    pages: data.pages,
    seed: context.seed
  });
  return { at, title: reading.headline, body: reading.note ?? reading.subtext };
}

/** The notes for the week ahead, each written as of its own 11:11. */
export async function upcomingNotes(now: Date = new Date()): Promise<DailyNote[]> {
  const data = await sources();
  return noteTimes(now).map(at => noteFor(at, data));
}

/** Today's note, as it stands now — what "Send a test" shows. */
export async function noteForNow(now: Date = new Date()): Promise<DailyNote> {
  return noteFor(now, await sources());
}
