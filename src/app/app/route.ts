import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

export const dynamic = 'force-dynamic';

export async function GET() {
  const file = await readFile('/var/www/nova/public/downloads/BetVima.apk');

  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="BetVima.apk"',
      'Content-Length': String(file.length),
      'Cache-Control': 'no-store',
    },
  });
}
