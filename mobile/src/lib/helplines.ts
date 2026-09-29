/**
 * Crisis lines by region (report §8). The user's own region is listed first;
 * the rest stay visible, because people travel and phones lie about location.
 *
 * This list is safety-critical: every number must be re-verified by the
 * clinical advisory board before each release, and whenever a launch country
 * is added.
 */

export type Helpline = {
  region: string;
  regionName: string;
  name: string;
  /** Human-readable, as the service itself writes it. */
  display: string;
  call?: string;
  text?: string;
  hours: string;
};

export const helplines: readonly Helpline[] = [
  {
    region: 'US',
    regionName: 'United States',
    name: '988 Suicide & Crisis Lifeline',
    display: '988',
    call: '988',
    text: '988',
    hours: 'call or text, 24/7'
  },
  {
    region: 'IN',
    regionName: 'India',
    name: 'Tele-MANAS',
    display: '14416',
    call: '14416',
    hours: 'call, 24/7, free'
  },
  {
    region: 'GB',
    regionName: 'United Kingdom',
    name: 'Samaritans',
    display: '116 123',
    call: '116123',
    hours: 'call, 24/7, free'
  }
];

/** Emergency services, for immediate danger. */
export const emergencyNumbers: Record<string, string> = {
  US: '911',
  IN: '112',
  GB: '999'
};

/** Default when the region is unknown or not a launch country. */
export const FALLBACK_EMERGENCY = '112';

export function helplinesFor(region: string | null): Helpline[] {
  const own = helplines.filter(h => h.region === region);
  const rest = helplines.filter(h => h.region !== region);
  return [...own, ...rest];
}

export function emergencyNumberFor(region: string | null): string {
  return (region && emergencyNumbers[region]) || FALLBACK_EMERGENCY;
}
