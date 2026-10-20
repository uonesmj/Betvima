import { NextResponse } from 'next/server';
import { readFile, access, open } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createServices } from '@/server/services/container';
import { enforceRateLimit } from '@/server/http/request';
import { clientIpFromHeaders } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const ANDROID_DIR = '/var/www/betvima-android';
const DOWNLOAD_DIR = '/var/www/nova/public/downloads/affiliate-app';
const VERSION_FILE = path.join(ANDROID_DIR, 'app/build.gradle.kts');
// A deployment must update the installed native sources before enabling downloads.
// Native 0.125.0 removes user-facing referral diagnostics while preserving attribution.
// Older releases must not be shipped to newly referred users.
const MINIMUM_NATIVE_VERSION = 125;
const QUEUE_DIR = '/var/lib/betvima-affiliate-build/queue';
const RUNNING_DIR = '/var/lib/betvima-affiliate-build/running';
const FAILED_DIR = '/var/lib/betvima-affiliate-build/failed';
const RELEASE_CERT_SHA256 = 'b87c0c775b630fbfb4773c2f508fc54fce2e09387443430cd041c95af9a66f90';

const validCode = (code: string): boolean => /^[A-Z0-9_-]{3,64}$/.test(code);
const nativeVersion = (gradle: string): { code: number; name: string } | null => {
  const versionCode = gradle.match(/^\s*versionCode\s*=\s*(\d+)\s*$/m);
  const versionName = gradle.match(/^\s*versionName\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"\s*$/m);
  if (!versionCode || !versionName) return null;
  const name = versionName[1];
  const code = Number(versionCode[1]);
  if (!name || !Number.isSafeInteger(code)) return null;
  return { code, name };
};

// Production Next.js inherits a restricted PATH from the reviewed deployer.
// Resolve SDK tools by absolute path rather than assuming 'apksigner' or
// '/usr/local/bin/gradle' is visible to PM2. Never search untrusted paths.
const SDK_PATHS = [
  '/usr/local/lib/android/sdk', '/opt/android-sdk', '/usr/lib/android-sdk',
  '/home/novaadmin/Android/Sdk',
];
async function firstExecutable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try { await access(candidate, fsConstants.X_OK); return candidate; } catch { /* next */ }
  }
  return null;
}
const signerCandidates = [
  '/usr/bin/apksigner', '/usr/local/bin/apksigner',
  ...SDK_PATHS.map(dir => path.join(dir, 'build-tools/35.0.0/apksigner')),
];
async function signedApk(file: string, signer: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(signer, ['verify', '--print-certs', file], {
      timeout: 20_000, maxBuffer: 128_000,
    });
    const fingerprint = stdout.match(/^Signer #1 certificate SHA-256 digest: ([a-f0-9]+)\s*$/im);
    return fingerprint?.[1]?.toLowerCase() === RELEASE_CERT_SHA256;
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = String(code ?? '').trim().toUpperCase();
  if (!validCode(clean)) {
    return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 400 });
  }

  // Public player downloads are expected, but unbounded builds per code are not.
  await enforceRateLimit(
    `partner-apk:${clientIpFromHeaders(request.headers) ?? 'unknown'}`,
    12, 900,
  );

  const services = createServices();
  const affiliate = await services.affiliate.getByCode(clean).catch(() => null);
  if (!affiliate || affiliate.status !== 'approved') {
    return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 404 });
  }

  const source = await readFile(VERSION_FILE, 'utf8').catch(() => null);
  const version = source ? nativeVersion(source) : null;
  if (!version || version.code < MINIMUM_NATIVE_VERSION) {
    return NextResponse.json(
      { ok: false, error: 'ANDROID_SOURCE_NOT_UPDATED' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // A different filename per native release prevents returning an old partner APK.
  const filename = `${clean}-v${version.name}.apk`;
  const output = path.join(DOWNLOAD_DIR, filename);

  try {
    await access(output, fsConstants.R_OK);
  } catch {
    // Only the separate systemd worker can use the signing key.
    // The public web process never receives signing credentials.
    try {
      await access(QUEUE_DIR, fsConstants.W_OK);
      await access(FAILED_DIR, fsConstants.X_OK);
      await access(RUNNING_DIR, fsConstants.X_OK);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'ANDROID_BUILD_WORKER_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    try {
      await access(path.join(FAILED_DIR, clean), fsConstants.F_OK);
      return NextResponse.json(
        { ok: false, error: 'ANDROID_BUILD_FAILED_CONTACT_SUPPORT' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch { /* first attempt */ }

    let inProgress = false;
    try {
      await access(path.join(RUNNING_DIR, clean), fsConstants.F_OK);
      inProgress = true;
    } catch { /* still queued or new */ }
    if (!inProgress) {
      const queuePath = path.join(QUEUE_DIR, clean + '.request');
      try {
        const handle = await open(queuePath, 'wx', 0o600);
        await handle.close();
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
          return NextResponse.json(
            { ok: false, error: 'ANDROID_BUILD_QUEUE_UNAVAILABLE' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          );
        }
      }
    }
    const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Retry-After': '45' };
    // /app/affiliate/<CODE> redirects here. Do not show raw JSON in Chrome.
    if (request.headers.get('accept')?.includes('text/html')) {
      return new NextResponse(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<meta http-equiv="refresh" content="45"><title>Preparing BetVima Android</title>' +
        '<style>body{font-family:system-ui,sans-serif;background:#071621;color:#fff;' +
        'min-height:100vh;display:grid;place-items:center;margin:0;text-align:center}' +
        'main{max-width:520px;padding:32px}h1{color:#12cc86}p{line-height:1.8}' +
        '</style></head><body><main><h1>BetVima Android</h1>' +
        '<p>Your personalized Android app is being prepared securely.' +
        ' This page will refresh automatically to start the download.</p>' +
        '<p lang="fa" dir="rtl">نسخه اختصاصی اندروید شما در حال آماده‌سازی است.' +
        ' دانلود پس از تکمیل به‌صورت خودکار آغاز می‌شود.</p>' +
        '<small>Affiliate: ' + clean + '</small></main></body></html>',
        { status: 202, headers: {
          ...headers, 'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
          'X-Content-Type-Options': 'nosniff',
        } },
      );
    }
    return NextResponse.json(
      { ok: true, status: 'building', code: clean, retryAfterSeconds: 45 },
      { status: 202, headers },
    );
  }

  const verifier = await firstExecutable(signerCandidates);
  if (!verifier || !(await signedApk(output, verifier))) {
    return NextResponse.json(
      { ok: false, error: 'ANDROID_APK_SIGNATURE_INVALID' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const file = await readFile(output);
  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="BetVima-${clean}-v${version.name}.apk"`,
      'Content-Length': String(file.length),
      // This stable URL must always resolve to the current installed native version.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
