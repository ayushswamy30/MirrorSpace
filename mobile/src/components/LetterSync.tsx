import { useEffect } from 'react';
import { AppState } from 'react-native';

import { deliverDue } from '@/lib/letters';

/**
 * Delivers letters whose day has come when the app opens or returns — or
 * holds them another week if the days have been heavy. Renders nothing.
 */
export function LetterSync({ onDelivered }: { onDelivered?: () => void }) {
  useEffect(() => {
    const check = () => {
      deliverDue()
        .then(delivered => {
          if (delivered.length) onDelivered?.();
        })
        .catch(err => console.warn('Letters not checked:', err));
    };
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [onDelivered]);

  return null;
}
