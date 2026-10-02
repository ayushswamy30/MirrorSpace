import { composePage, dailyPrompt, TEMPLATES } from '../prompts';
import { localDate, type CheckIn } from '../checkIns';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const NOW = new Date(2026, 9, 2, 20, 0);

function at(hoursAgo: number, energy: number, pleasantness: number, tags: string[] = []): CheckIn {
  const d = new Date(NOW.getTime() - hoursAgo * 3600 * 1000);
  return { id: `${hoursAgo}`, createdAt: d.toISOString(), localDate: localDate(d), emotion: 'x', energy, pleasantness, tags, note: null };
}

test('the prompt says why it was chosen, and stays the same all day', () => {
  const heavy = [at(1, -3, -4), at(20, -3, -4)];
  const prompt = dailyPrompt(heavy, NOW);
  expect(prompt.because).toBe('chosen because the last days read as fog');
  expect(dailyPrompt(heavy, new Date(NOW.getTime() - 3 * 3600 * 1000)).text).toBe(prompt.text);
});

test('what keeps coming up this week picks the theme', () => {
  const work = [at(1, 1, 1, ['work']), at(30, 1, 1, ['study']), at(50, 0, 1)];
  expect(dailyPrompt(work, NOW).because).toBe('chosen because 2 check-ins this week mention work or study');
  expect(dailyPrompt([], NOW).because).toBe('a prompt to begin with');
});

test('templates fold into a plain page', () => {
  const thanks = TEMPLATES.find(t => t.kind === 'thanks')!;
  expect(composePage(thanks, { text: '', lines: [' tea ', '', 'the walk'], to: '' })).toBe('1. tea\n2. the walk');
  const unsent = TEMPLATES.find(t => t.kind === 'unsent')!;
  expect(composePage(unsent, { text: 'I was hurt.', lines: [], to: 'Sam' })).toBe('Dear Sam,\n\nI was hurt.');
});
