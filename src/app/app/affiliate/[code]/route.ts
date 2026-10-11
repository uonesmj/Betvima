import { NextResponse } from 'next/server';
import { createServices } from '@/server/services/container';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = String(code ?? '').trim().toUpperCase();

  if (!/^[A-Z0-9_-]{3,64}$/.test(clean)) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_REFERRAL_CODE' },
      { status: 400 },
    );
  }

  const base = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return NextResponse.redirect(
    new URL(`/api/v1/affiliate/app-download/${encodeURIComponent(clean)}`, base),
    302,
  );
}
