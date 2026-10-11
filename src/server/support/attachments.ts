import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/errors';
import { serviceRoleClient } from '@/server/db/supabase';

export const SUPPORT_ATTACHMENT_BUCKET = 'support-attachments';
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function safeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/\0]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 160);

  return cleaned || 'attachment';
}

function matchesMagic(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }

  if (mime === 'image/png') {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
  }

  if (mime === 'image/webp') {
    return bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  }

  if (mime === 'application/pdf') {
    return bytes.length >= 5 &&
      new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  }

  return false;
}

export async function uploadSupportAttachment(ticketId: string, file: File) {
  if (!(file instanceof File)) {
    throw new ApiError('VALIDATION_FAILED', 'A file is required.');
  }

  if (file.size <= 0 || file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
    throw new ApiError('VALIDATION_FAILED', 'File must be between 1 byte and 10MB.');
  }

  const mime = file.type;

  if (!ALLOWED[mime]) {
    throw new ApiError(
      'VALIDATION_FAILED',
      'Only JPG, PNG, WEBP and PDF files are allowed.',
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!matchesMagic(bytes, mime)) {
    throw new ApiError(
      'VALIDATION_FAILED',
      'The uploaded file content does not match its type.',
    );
  }

  const storagePath = `${ticketId}/${randomUUID()}.${ALLOWED[mime]}`;

  const { error } = await serviceRoleClient()
    .storage
    .from(SUPPORT_ATTACHMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mime,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new ApiError(
      'INTERNAL_ERROR',
      `Attachment upload failed: ${error.message}`,
    );
  }

  return {
    bucketId: SUPPORT_ATTACHMENT_BUCKET,
    storagePath,
    originalName: safeName(file.name),
    mimeType: mime,
    sizeBytes: file.size,
  };
}

export async function removeSupportAttachment(storagePath: string) {
  await serviceRoleClient()
    .storage
    .from(SUPPORT_ATTACHMENT_BUCKET)
    .remove([storagePath]);
}
