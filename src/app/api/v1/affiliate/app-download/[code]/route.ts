import { NextResponse } from 'next/server';
import { readFile, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createServices } from '@/server/services/container';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const ANDROID_DIR = '/var/www/betvima-android';
const DOWNLOAD_DIR = '/var/www/nova/public/downloads/affiliate-app';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = String(code ?? '').trim().toUpperCase();

  if (!/^[A-Z0-9_-]{3,64}$/.test(clean)) {
    return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 400 });
  }

  const services = createServices();
  const affiliate = await services.affiliate.getByCode(clean).catch(() => null);

  if (!affiliate) {
    return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 404 });
  }

  const filename = `${clean}.apk`;
  const output = path.join(DOWNLOAD_DIR, filename);

  await mkdir(DOWNLOAD_DIR, { recursive: true });

  try {
    await access(output);
  } catch {
    const lockFile = path.join(DOWNLOAD_DIR, `${clean}.lock`);
    const lockScript = [
      'set -e',
      `mkdir -p '${DOWNLOAD_DIR}'`,
      `if [ -f '${output}' ]; then exit 0; fi`,
      `cd '${ANDROID_DIR}'`,
      `./gradlew assembleRelease -PaffiliateRef='${clean}'`,
      `cp 'app/build/outputs/apk/release/app-release.apk' '${output}.tmp'`,
      `mv '${output}.tmp' '${output}'`,
    ].join(' && ');

    try {
      await execFileAsync('flock', ['-x', lockFile, '-c', lockScript], {
        cwd: ANDROID_DIR,
        timeout: 180000,
        maxBuffer: 1024 * 1024 * 4,
      });
    } catch (error) {
      console.error('[affiliate-app-build]', clean, error);
      return NextResponse.json(
        { ok: false, error: 'APP_BUILD_FAILED' },
        { status: 500 },
      );
    }
  }

  const file = await readFile(output);

  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="BetVima-${clean}.apk"`,
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
