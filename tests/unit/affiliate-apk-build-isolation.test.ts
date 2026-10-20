import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (name: string) => readFileSync(path.join(process.cwd(), name), 'utf8');

describe('secure automatic affiliate APK build', () => {
  it('queues missing builds rather than running Gradle under Next.js', () => {
    const route = read('src/app/api/v1/affiliate/app-download/[code]/route.ts');
    expect(route).toContain("open(queuePath, 'wx', 0o600)");
    expect(route).toContain("status: 'building'");
    expect(route).toContain('Retry-After');
    expect(route).not.toContain('assembleRelease');
    expect(route).not.toContain('BETVIMA_ANDROID_KEYSTORE_PASSWORD');
    expect(route).toContain('RELEASE_CERT_SHA256');
    expect(route).toContain('ANDROID_BUILD_FAILED_CONTACT_SUPPORT');
    // Auto-refresh and already-queued builds cannot consume the 12/15m quota.
    expect(route).toContain("throttleDownload(request, 'request')");
    expect(route).toContain("throttleDownload(request, 'new-build')");
    expect(route).toContain('alreadyQueued');
    expect(route).toContain("status: 429");
    expect(route).toContain("error.code !== 'RATE_LIMITED'");
    expect(route).toContain("hashSignal(clientIpFromHeaders(request.headers)");
    expect(route).toContain("kind === 'request' ? 120 : 12");
    expect(route).not.toContain("partner-apk:${clientIpFromHeaders(request.headers)");
  });

  it('pins affiliate source, download and isolated worker to the same approved native version', () => {
    const sync = read('ops/android/sync-affiliate-build-source.sh');
    const install = read('ops/android/install-affiliate-apk-worker.sh');
    const worker = read('ops/android/affiliate_apk_worker.py');
    const route = read('src/app/api/v1/affiliate/app-download/[code]/route.ts');
    const approvedSha = 'e32bb3fc280a60e01e6d6736a8cb111b1d613a36';
    expect(sync).toContain(`SHA='${approvedSha}'`);
    expect(sync).toContain('versionCode[[:space:]]*=[[:space:]]*130');
    expect(sync).toContain('0\\.130\\.0');
    expect(sync).toContain('android_source_installed=v0.130.0');
    expect(install).toContain(approvedSha);
    expect(install).toContain('versionCode[[:space:]]*=[[:space:]]*130');
    expect(install).toContain('0\\.130\\.0');
    expect(install).toContain('native_version=0.130.0');
    expect(worker).toContain('int(code.group(1)) < 130');
    expect(route).toContain('const MINIMUM_NATIVE_VERSION = 130');
    expect(route).not.toContain('const MINIMUM_NATIVE_VERSION = 125');
  });

  it('signs within an isolated dedicated builder and validates referral attribution', () => {
    const worker = read('ops/android/affiliate_apk_worker.py');
    expect(worker).toContain('pwd.getpwnam("betvimaapk")');
    expect(worker).toContain('"/usr/bin/setpriv"');
    expect(worker).toContain('"--clear-groups",');
    expect(worker).toContain('"--no-new-privs", "--"');
    expect(worker).not.toContain('preexec_fn=drop_privileges');
    expect(worker).toContain('"--max-workers=1"');
    expect(worker).toContain('"--stacktrace"');
    expect(worker).toContain('CERT_SHA256');
    expect(worker).toContain('AFFILIATE_REFERRAL_CODE');
    expect(worker).toContain('os.replace(temp_path, output)');
    expect(worker).toContain('os.replace(job, working)');
    expect(worker).toContain('os.replace(working, FAILED / code)');
  });

  it('rate limits build memory separately from web and persists scheduled builds', () => {
    const install = read('ops/android/install-affiliate-apk-worker.sh');
    expect(install).toContain('MemoryMax=3G');
    expect(install).toContain('TasksMax=256');
    expect(install).not.toContain('TasksMax=96');
    expect(install).toContain('NoNewPrivileges=false');
    expect(install).toContain('MemorySwapMax=3G');
    expect(install).toContain('OnUnitInactiveSec=30s');
    expect(install).toContain('native_sha_unapproved');
    expect(install).not.toContain('pm2 restart');
  });
});
