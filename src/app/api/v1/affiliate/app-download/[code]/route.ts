import { NextResponse } from 'next/server';
import { readFile, mkdir, access } from 'node:fs/promises';
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
const RELEASE_APK = path.join(ANDROID_DIR, 'app/build/outputs/apk/release/app-release.apk');
const VERSION_FILE = path.join(ANDROID_DIR, 'app/build.gradle.kts');
// A deployment must update the installed native sources before enabling downloads.
// The approved native 0.124.0 source includes the corrected affiliate reporting UX.
// Older pre-124 sources must not be shipped to newly referred users.
const MINIMUM_NATIVE_VERSION = 124;

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
const gradleCandidates = [
  '/opt/gradle/bin/gradle', '/opt/gradle-8.10.2/bin/gradle',
  '/usr/local/gradle/bin/gradle', '/usr/local/bin/gradle', '/usr/bin/gradle',
];
const signerCandidates = [
  '/usr/bin/apksigner', '/usr/local/bin/apksigner',
  ...SDK_PATHS.map(dir => path.join(dir, 'build-tools/35.0.0/apksigner')),
];
async function signedApk(file: string, signer: string): Promise<boolean> {
  try {
    await execFileAsync(signer, ['verify', '--print-certs', file], {
      timeout: 20_000, maxBuffer: 128_000,
    });
    return true;
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
  await mkdir(DOWNLOAD_DIR, { recursive: true });

  try {
    await access(output);
  } catch {
    const signerVars = [
      'BETVIMA_ANDROID_KEYSTORE_PATH',
      'BETVIMA_ANDROID_KEYSTORE_PASSWORD',
      'BETVIMA_ANDROID_KEY_ALIAS',
      'BETVIMA_ANDROID_KEY_PASSWORD',
    ] as const;
    if (signerVars.some((key) => !process.env[key]?.trim())) {
      // Do not publish a release APK without the real deployment signing key.
      return NextResponse.json(
        { ok: false, error: 'ANDROID_SIGNING_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const gradle = await firstExecutable(gradleCandidates);
    const signer = await firstExecutable(signerCandidates);
    if (!gradle || !signer) {
      return NextResponse.json(
        { ok: false, error: 'ANDROID_BUILD_TOOLS_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const tmp = `${output}.tmp`;
    // Inputs are validated before passing to a shell command. The global lock
    // avoids racing Gradle's shared output directory across different affiliates.
    const script = [
      'set -e',
      `cd '${ANDROID_DIR}'`,
      `if [ -f '${output}' ]; then exit 0; fi`,
      `'${gradle}' --no-daemon --no-configuration-cache :app:assembleRelease -PaffiliateRef='${clean}'`,
      // Fail closed rather than accidentally publishing a release with a
      // different partner ID left in a shared Gradle build directory.
      `grep -F 'AFFILIATE_REFERRAL_CODE = "${clean}"' 'app/build/generated/source/buildConfig/release/com/betvima/app/BuildConfig.java' > /dev/null`,
      `'${signer}' verify --print-certs '${RELEASE_APK}' > /dev/null`,
      `cp '${RELEASE_APK}' '${tmp}'`,
      `mv '${tmp}' '${output}'`,
    ].join('\n');
    try {
      await execFileAsync('flock', [
        '-w', '180', '-x', path.join(DOWNLOAD_DIR, '.native-build.lock'),
        '-c', script,
      ], { cwd: ANDROID_DIR, timeout: 480_000, maxBuffer: 4 * 1024 * 1024 });
    } catch (error) {
      console.error('[affiliate-app-build]', {
        code: clean,
        kind: error instanceof Error ? error.name : 'unknown',
        // No secrets, keystore passwords or raw command output in logs.
      });
      return NextResponse.json(
        { ok: false, error: 'APP_BUILD_FAILED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
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
