/**
 * The film's running order: [id, duration in ms]. Plain data, shared by the
 * page (src/timeline.jsx) and the score (scripts/score.mjs) so the music
 * moves on the same cuts as the picture.
 */
export const SCENES = [
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
].reduce((all, [id, dur]) => {
  const start = all.length ? all[all.length - 1].end : 0;
  all.push({ id, dur, start, end: start + dur });
  return all;
}, []);

export const TOTAL = SCENES[SCENES.length - 1].end;
