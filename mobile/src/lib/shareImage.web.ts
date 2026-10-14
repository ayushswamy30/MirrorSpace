import html2canvas from 'html2canvas';

/**
 * Sharing a card from the web app. The card is drawn from the page itself
 * (html2canvas) at three times its size — 1080×1920 — and handed to the
 * browser's share sheet, which on iPhone is the same one apps use. Where a
 * browser can't share files, the picture is saved instead.
 *
 * The share sheet only opens in direct answer to a tap, and drawing takes a
 * moment, so a card is drawn ahead of time (`renderCard`) and shared on tap.
 */

export const canShareImages = true;

/** Draws the card. It waits off screen; in the copy it is drawn from, it is brought on screen. */
export async function renderCard(node: unknown, paper: string): Promise<Blob> {
  const element = node as HTMLElement;
  if (typeof document !== 'undefined' && 'fonts' in document) await document.fonts.ready;
  const canvas = await html2canvas(element, {
    scale: 3,
    backgroundColor: paper,
    logging: false,
    useCORS: true,
    onclone: (_doc, clone) => {
      const holder = clone.parentElement;
      if (holder) {
        holder.style.left = '0px';
        holder.style.top = '0px';
      }
    }
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The card came out empty'))), 'image/png')
  );
}

export type ShareResult = 'shared' | 'saved' | 'cancelled' | 'needs-tap';

/** Opens the share sheet with the picture, or saves it where sharing files isn't possible. */
export async function shareImage(blob: Blob, name = 'lowkei.png'): Promise<ShareResult> {
  const file = new File([blob], name, { type: 'image/png' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      const kind = (error as { name?: string }).name;
      if (kind === 'AbortError') return 'cancelled';
      // The tap was too long ago (the card was still being drawn): ask for another.
      if (kind === 'NotAllowedError') return 'needs-tap';
      throw error;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
