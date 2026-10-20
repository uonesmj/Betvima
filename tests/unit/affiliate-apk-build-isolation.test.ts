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
    expect(route).toContain('APP_BUILD_FAILED_CONTACT_SUPPORT');
  });

  it('signs within an isolated dedicated builder and validates referral attribution', () => {
    const worker = read('ops/android/affiliate_apk_worker.py');
    expect(worker).toContain('pwd.getpwnam("betvimaapk")');
    expect(worker).toContain('os.setuid(builder.pw_uid)');
    expect(worker).toContain('"--max-workers=1"');
    expect(worker).toContain('CERT_SHA256');
    expect(worker).toContain('AFFILIATE_REFERRAL_CODE');
    expect(worker).toContain('os.replace(temp_path, output)');
    expect(worker).toContain('os.replace(job, FAILED / code)');
  });

  it('rate limits build memory separately from web and persists scheduled builds', () => {
    const install = read('ops/android/install-affiliate-apk-worker.sh');
    expect(install).toContain('MemoryMax=3G');
    expect(install).toContain('MemorySwapMax=3G');
    expect(install).toContain('OnUnitInactiveSec=30s');
    expect(install).toContain('native_sha_unapproved');
    expect(install).not.toContain('pm2 restart');
  });
});
