import { deliverDue, deliveryDate, PAUSE_DAYS } from '../letters';

const mockRun = jest.fn();
const mockAll = jest.fn();
jest.mock('../db/database', () => ({
  getDatabase: () => Promise.resolve({ runAsync: (...a: unknown[]) => mockRun(...a), getAllAsync: (...a: unknown[]) => mockAll(...a) })
}));
let mockCheckIns: unknown[] = [];
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: () => Promise.resolve(mockCheckIns) }));

const NOW = new Date(2026, 9, 2, 10, 0);
const due = { id: 'l1', created_at: '2026-04-02T09:00:00Z', body: 'hello me', deliver_at: '2026-10-02T03:30:00Z', delivered_at: null, opened_at: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckIns = [];
});

test('a letter opens on the morning of its day, months on', () => {
  const d = deliveryDate(6, NOW);
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 3, 2, 9]);
});

test('on its day, a letter is delivered', async () => {
  mockAll.mockResolvedValue([due]);
  const delivered = await deliverDue(NOW);
  expect(delivered.map(l => l.id)).toEqual(['l1']);
  expect(mockRun).toHaveBeenCalledWith('UPDATE letters SET delivered_at = ? WHERE id = ?', NOW.toISOString(), 'l1');
});

test('in a heavy stretch, it waits another week instead', async () => {
  const { localDate } = jest.requireActual('../checkIns');
  const heavy = (h: number) => {
    const at = new Date(NOW.getTime() - h * 3600 * 1000);
    return { id: `${h}`, createdAt: at.toISOString(), localDate: localDate(at), emotion: 'x', energy: -3, pleasantness: -4, tags: [], note: null };
  };
  mockCheckIns = [heavy(1), heavy(25)];
  mockAll.mockResolvedValue([due]);
  expect(await deliverDue(NOW)).toEqual([]);
  const later = new Date(NOW.getTime() + PAUSE_DAYS * 24 * 3600 * 1000).toISOString();
  expect(mockRun).toHaveBeenCalledWith('UPDATE letters SET deliver_at = ? WHERE id = ?', later, 'l1');
});
