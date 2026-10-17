import { describe, expect, it } from 'vitest';
import { detectedDocumentType, KYC_MAX_FILE_BYTES } from '@/server/kyc/files';

describe('KYC evidence file detection', () => {
  it('accepts common identity document formats by magic bytes', () => {
    const jpg = Uint8Array.from([0xff,0xd8,0xff,0x00,0,0,0,0,0,0,0,0]);
    const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
    const pdf = new TextEncoder().encode('%PDF-1.4\nrest');
    const webp = new TextEncoder().encode('RIFF----WEBP');
    expect(detectedDocumentType(jpg)?.mime).toBe('image/jpeg');
    expect(detectedDocumentType(png)?.mime).toBe('image/png');
    expect(detectedDocumentType(pdf)?.mime).toBe('application/pdf');
    expect(detectedDocumentType(webp)?.mime).toBe('image/webp');
  });
  it('rejects HTML, SVG, invalid or tiny payloads', () => {
    for (const text of ['<html>evil</html>', '<svg>svg</svg>', 'garbage', '']) {
      expect(detectedDocumentType(new TextEncoder().encode(text))).toBeNull();
    }
  });
  it('limits every submitted object to eight megabytes', () => {
    expect(KYC_MAX_FILE_BYTES).toBe(8 * 1024 * 1024);
  });
});
