import { useEffect } from 'react';

import { retryPending } from '@/lib/reflections';
import { useProfile } from '@/lib/session';

/**
 * Pages kept while offline (or while the server slept) still wait for their
 * reflection; this asks again when the app opens. Only with the consent.
 */
export function ReflectionSync() {
  const allowed = useProfile().consents.ai_reflections?.granted === true;

  useEffect(() => {
    if (!allowed) return;
    retryPending().catch(err => console.warn('Reflections not retried:', err));
  }, [allowed]);

  return null;
}
