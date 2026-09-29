import { router } from 'expo-router';

import { recordSafetyEvent, type SafetySource } from './log';
import { atLeast, type Tier } from './screen';

/**
 * The one way a screened tier becomes a response (report §8): log it (tier,
 * source, time — never the words), and for elevated or acute open the crisis
 * screen over whatever is showing. A low tier is answered in place by the
 * screen itself, with a care line.
 */
export function answerConcern(tier: Tier, source: SafetySource): void {
  if (tier === 'none') return;
  recordSafetyEvent(tier, source).catch(err => console.warn('Safety event not logged:', err));
  if (atLeast(tier, 'elevated')) router.push(`/crisis?tier=${tier}`);
}
