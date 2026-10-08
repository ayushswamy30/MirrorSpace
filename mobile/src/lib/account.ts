import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api } from './api';
import { allCheckIns } from './checkIns';
import { CONSENT_POLICY_VERSION, type ConsentPurpose } from './consent';
import { destroyLocalData } from './db/database';
import { listExperiments } from './experiments';
import { listLetters } from './letters';
import { listMessages } from './mirror';
import { listSafetyEvents } from './safety/log';
import { loadPlan } from './safetyPlan';
import { allSleep } from './sleep';
import { supabase } from './supabase';
import { isPreview } from './preview';
import { listVents } from './vents';

/**
 * The person's control over their own data (report §9: one-tap export, one-tap
 * delete). Most of what Lowkei holds is on this phone, so both reach the
 * phone as well as the server — an export that left out the journal, or a
 * delete that left it behind, would be a false promise.
 */

export type ExportFile = {
  exportedAt: string;
  onThisPhone: {
    checkIns: unknown[];
    ventPages: unknown[];
    sleep: unknown[];
    mirrorConversation: unknown[];
    safetyPlan: unknown;
    /** Tier, source and time only — the same as was ever recorded. */
    safetyEvents: unknown[];
    /** Letters to future self, sealed ones included — they're the person's own. */
    letters: unknown[];
    /** Seven-day experiments, with the days marked kept. */
    experiments: unknown[];
  };
  /** Everything the server holds, or null if it couldn't be reached. */
  server: unknown;
  serverError?: string;
};

export async function buildExport(now: Date = new Date()): Promise<ExportFile> {
  const [checkIns, ventPages, sleep, mirrorConversation, safetyPlan, safetyEvents, letters, experiments] = await Promise.all([
    allCheckIns(),
    listVents(100_000),
    allSleep(),
    listMessages(100_000),
    loadPlan(),
    listSafetyEvents(),
    listLetters(),
    listExperiments()
  ]);

  let server: unknown = null;
  let serverError: string | undefined;
  try {
    server = await api.get('/user/export');
  } catch (error) {
    serverError = error instanceof Error ? error.message : 'The server could not be reached.';
  }

  return {
    exportedAt: now.toISOString(),
    onThisPhone: { checkIns, ventPages, sleep, mirrorConversation, safetyPlan, safetyEvents, letters, experiments },
    server,
    ...(serverError ? { serverError } : {})
  };
}

/** Writes the export to the app's cache and opens the share sheet for it. */
export async function shareExport(): Promise<ExportFile> {
  const data = await buildExport();
  const file = new File(Paths.cache, `lowkei-${data.exportedAt.slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Your Lowkei data',
    UTI: 'public.json'
  });
  return data;
}

/**
 * Erase everything: the account on the server (which cascades through every
 * row), then this phone's database and its key. The server goes first — if
 * it can't be reached nothing is touched, rather than leaving the account
 * alive with the phone wiped.
 */
export async function eraseEverything(): Promise<void> {
  await api.delete('/user');
  // The session now names a deleted user; only the local copy needs clearing.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await destroyLocalData();
}

export async function setConsent(purpose: ConsentPurpose, granted: boolean): Promise<void> {
  if (isPreview) return;
  await api.put('/user/consents', { consents: { [purpose]: granted }, policyVersion: CONSENT_POLICY_VERSION });
}
