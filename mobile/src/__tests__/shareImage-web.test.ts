import { shareImage } from '@/lib/shareImage.web';

jest.mock('html2canvas', () => jest.fn());

const refused = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

let clicked: string[];

beforeEach(() => {
  clicked = [];
  if (typeof globalThis.File === 'undefined') {
    (globalThis as any).File = class extends Blob {
      constructor(parts: BlobPart[], public name: string, options?: BlobPropertyBag) {
        super(parts, options);
      }
    };
  }
  (globalThis as any).navigator = { share: jest.fn(() => Promise.reject(refused)), canShare: () => true };
  (globalThis as any).URL.createObjectURL = () => 'blob:card';
  (globalThis as any).URL.revokeObjectURL = () => {};
  (globalThis as any).document = {
    body: { appendChild: () => {} },
    createElement: () => {
      const link = { href: '', download: '', click: () => clicked.push(link.download), remove: () => {} };
      return link;
    }
  };
});

const card = new Blob(['png'], { type: 'image/png' });

test('a card drawn after the tap, refused, asks for one more tap', async () => {
  expect(await shareImage(card, 'lowkei.png', true)).toBe('needs-tap');
  expect(clicked).toEqual([]);
});

test('a ready card the browser still refuses is saved instead', async () => {
  expect(await shareImage(card, 'lowkei.png', false)).toBe('saved');
  expect(clicked).toEqual(['lowkei.png']);
});
