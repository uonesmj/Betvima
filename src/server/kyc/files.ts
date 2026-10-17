/** Server-only file type validation. MIME and extensions supplied by users are untrusted. */
export const KYC_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const KYC_BUCKET = 'betvima-kyc';

export function detectedDocumentType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a)
    return { mime: 'image/png', extension: 'png' };
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
    return { mime: 'image/webp', extension: 'webp' };
  if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-')
    return { mime: 'application/pdf', extension: 'pdf' };
  return null;
}

export function permittedKycFile(file: File, bytes: Uint8Array) {
  if (file.size < 12 || file.size > KYC_MAX_FILE_BYTES || file.size !== bytes.byteLength)
    throw new Error('KYC_INVALID_FILE_SIZE');
  const detected = detectedDocumentType(bytes);
  if (!detected || file.type !== detected.mime) throw new Error('KYC_INVALID_FILE_TYPE');
  return detected;
}
