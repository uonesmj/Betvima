# Affiliate-branded Android APKs — operator runbook

## What the `ANDROID_SOURCE_NOT_UPDATED` error means

The public route `/api/v1/affiliate/app-download/<APPROVED_CODE>` checks
`/var/www/betvima-android/app/build.gradle.kts` **on the live VPS**, before
building or serving a branded APK. The error is HTTP 503 when that file cannot
be read, is malformed, or declares a versionCode below the minimum native
version allowed by the live route. This is **not** evidence of a broken affiliate
account or invalid referral code: the approved affiliate has already passed
the earlier lookup.

A GitHub Android build, GitHub merge or production web deployment **does not**
update the native source or APK signing worker on the VPS. Native deployment is
an independently controlled root operation.

## Approved Android 0.134.0 source

- Native ref: `feat/android-134-my-bets-tickets-20261020`.
- Pinned, reviewed source SHA: `0ea6675bedbc79a18258a1cc4c4452903e23032d`.
- Version: `versionCode=134`, `versionName=0.134.0`.
- On-demand APKs contain `BuildConfig.AFFILIATE_REFERRAL_CODE` for the
  specific approved partner, with no secrets embedded into `BuildConfig`.
- The public download endpoint, native source installer, isolated worker
  installer and worker guard now all agree on **134**.

Do not change this SHA to a moving branch head, accept an older unreviewed
version, or disable the signing certificate checks to make the endpoint return
200.

## Installation on the production VPS

**Prerequisite:** the changed files must pass CI, be merged into the approved
web release and deployed by the site's *signed owner-initiated production
workflow*. The GitHub push / Preview deployment alone does not suffice.

Only a VPS administrator with actual root access should run the following in
order, using **the immutable path of the production release that contains these
scripts**:

```sh
sudo bash /opt/nova-releases/<APPROVED_MAIN_SHA>/ops/android/sync-affiliate-build-source.sh
sudo bash /opt/nova-releases/<APPROVED_MAIN_SHA>/ops/android/install-affiliate-apk-worker.sh
```

1. The source sync script locks `.native-build.lock`, fetches the pinned Git
   commit and validates the exact version, signing configuration and affiliate
   attribution marker. It installs the reviewed source at the stable symlink
   `/var/www/betvima-android` while preserving the previous source directory.
2. The worker installer validates the **same SHA and version**, synchronizes
   its isolated build workspace, preserves the previous workspace, and installs
   the `betvima-affiliate-apk.timer` systemd timer. It does not restart PM2,
   modify wallets/bets, or copy signing secrets to Next.js.
3. Do **not** run an older `0.125.0`/`0.130.0` worker installer after
   upgrading. Doing so may roll back the isolated build workspace.
4. Keep the original production release keystore and certificate fingerprint.
   The scripts intentionally fail closed if private signing assets or Android
   build tools are absent.

### Read-only verification

```sh
readlink -f /var/www/betvima-android
grep -E 'version(Code|Name)' /var/www/betvima-android/app/build.gradle.kts
cat /var/www/betvima-android/.betvima-native-commit
sudo systemctl is-active betvima-affiliate-apk.timer
sudo journalctl -u betvima-affiliate-apk.service --no-pager -n 35
```

Expected: version `134 / 0.134.0`, pinned commit `0ea6675b...`, and an
active worker timer. Do not paste secret values or unredacted private build logs
into support conversations.

### End-to-end download test

Visit `https://betvima.com/app/affiliate/<APPROVED_CODE>` for an **approved**
affiliate. If its signed release APK is not already ready, a browser receives
an HTML preparation page, automatically refreshed at most every 45 seconds.
The separate root-owned timer performs one queued build. When ready, the
endpoint returns HTTP 200 with
`Content-Type: application/vnd.android.package-archive` and a
`BetVima-<CODE>-v0.134.0.apk` attachment.

Verify the APK certificate with `apksigner verify --print-certs` and confirm
that the correct affiliate code was compiled into the build. On a test device,
check attribution with a *new* account before distributing the APK.

If the endpoint now reports `ANDROID_BUILD_WORKER_NOT_CONFIGURED`, the native
source guard passed but the worker queue / permissions were not provisioned.
If it reports `ANDROID_BUILD_FAILED_CONTACT_SUPPORT`, inspect
`/var/lib/betvima-affiliate-build/last-build.log` privately as root and
repair the worker before clearing the affected code's failure marker. Never
repeatedly retry a resource-exhausting build without diagnosis.

## Release boundaries

The publicly downloadable GitHub Actions `assembleDebug` APK is **not** an
affiliate production APK. A per-partner production build must use the same
private release-signing key as prior installs, be bound to the correct partner
code, and pass the pinned certificate check. The web process never receives
the keystore/passwords or invokes Gradle directly.

The source and worker upgrade is separate from the website's signed
production deployment. Do not assert that downloads are fixed before
checking the actual VPS and the HTTP response for an approved affiliate.
