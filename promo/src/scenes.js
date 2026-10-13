/**
 * Running orders: [id, duration in ms]. Plain data, shared by the page
 * (src/timeline.jsx) and the score (scripts/score.mjs) so the music moves on
 * the same cuts as the picture.
 *
 *   promo — the 2½-minute 16:9 walkthrough
 *   reel  — the vertical cut, under a minute; every length is a multiple of
 *           half a bar at 96 bpm (1.25 s), so each cut lands on the beat
 */
const ORDERS = {
  promo: [
    ['intro', 6000],
    ['hook', 6000],
    ['begin', 10500],
    ['today', 14000],
    ['checkin', 14500],
    ['vent', 13000],
    ['mirror', 14500],
    ['chart', 14500],
    ['circle', 12000],
    ['calm', 11500],
    ['care', 11000],
    ['yours', 12000],
    ['outro', 9000]
  ],
  reel: [
    ['hook', 3750],
    ['checkin', 7500],
    ['today', 5000],
    ['vent', 5000],
    ['letters', 3750],
    ['mirror', 7500],
    ['chart', 5000],
    ['circle', 5000],
    ['calm', 5000],
    ['crisis', 1250],
    ['lowday', 1250],
    ['dark', 1250],
    ['data', 1250],
    ['outro', 6250]
  ]
};

export function film(name = 'promo') {
  return (ORDERS[name] ?? ORDERS.promo).reduce((all, [id, dur]) => {
    const start = all.length ? all[all.length - 1].end : 0;
    all.push({ id, dur, start, end: start + dur });
    return all;
  }, []);
}

export const FILMS = Object.keys(ORDERS);
