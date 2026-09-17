import { NdyQrRenderService, NDY_QR_BRAND } from './ndyqr-render.service';

/**
 * These tests exercise the real renderer (qrcode + sharp + jsqr) rather than
 * mocking it — the whole point of this service is that it produces a genuinely
 * scannable code in Node without a canvas, so a test that stubbed sharp would
 * verify nothing.
 */
describe('NdyQrRenderService', () => {
  const renderer = new NdyQrRenderService();
  const TEXT = 'https://api.ndyhub.com/q/ndy7f3k9';

  describe('renderSvg', () => {
    it('produces a self-contained SVG containing the NDY gradient', () => {
      const svg = renderer.renderSvg(TEXT);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('</svg>');
      expect(svg).toContain(NDY_QR_BRAND.colorFrom);
      expect(svg).toContain(NDY_QR_BRAND.colorMid);
      expect(svg).toContain(NDY_QR_BRAND.colorTo);
      // The reserved centre mark, not a pasted-over logo.
      expect(svg).toContain('>ND</text>');
    });

    it('honours a per-code tint override', () => {
      const svg = renderer.renderSvg(TEXT, {
        colorFrom: '#111111',
        colorTo: '#222222',
      });
      expect(svg).toContain('#111111');
      expect(svg).toContain('#222222');
      expect(svg).not.toContain(NDY_QR_BRAND.colorFrom);
    });
  });

  describe('renderPng', () => {
    it('returns real PNG bytes at the requested size', async () => {
      const png = await renderer.renderPng(TEXT, { sizePx: 512 });
      // PNG magic number.
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const dimensions = png.readUInt32BE(16);
      expect(dimensions).toBe(512);
    });
  });

  describe('decodePng / validate', () => {
    it('decodes a rendered code back to exactly the encoded text', async () => {
      const png = await renderer.renderPng(TEXT);
      expect(await renderer.decodePng(png)).toBe(TEXT);
    });

    it('validates a code as scannable even with the reserved centre + logo ratio', async () => {
      // The real risk this guards: a centre reservation that overruns the
      // Level-H error-correction budget would render beautifully and not scan.
      expect(await renderer.validate(TEXT)).toBe(true);
    });

    it('still scans with a custom tint', async () => {
      expect(
        await renderer.validate(TEXT, { colorFrom: '#0f0f0f', colorTo: '#3b3b3b' }),
      ).toBe(true);
    });

    it('returns null for bytes that are not a QR code', async () => {
      const png = await renderer.renderPng(TEXT);
      // Corrupt the image so nothing can decode it.
      const broken = Buffer.alloc(png.length, 0);
      expect(await renderer.decodePng(broken)).toBeNull();
    });
  });
});
