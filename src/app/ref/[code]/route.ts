import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const cleanCode = code?.trim();

  if (!cleanCode || cleanCode.includes('/')) {
    return NextResponse.redirect(new URL('/', 'https://betvima.com'), 302);
  }

  const target = new URL(
    `/api/v1/ref/${encodeURIComponent(cleanCode)}`,
    'https://betvima.com',
  );
  target.searchParams.set('to', '/');

  const campaign = request.nextUrl.searchParams.get('utm_campaign');
  if (campaign) target.searchParams.set('utm_campaign', campaign);

  return NextResponse.redirect(target, 302);
}
