# Signed, affiliate-branded native Android APKs

## Why downloads returned `ANDROID_SOURCE_NOT_UPDATED`

The endpoint `/api/v1/affiliate/app-download/<APPROVED_AFFILIATE_CODE>`
reads `/var/www/betvima-android/app/build.gradle.kts` on the **production VPS**.
The website CD pipeline deploys Next.js from `main` but does **not** install
the separate native Android source tree. A green web deployment therefore
does not fix a missing/stale `/var/www/betvima-android` directory.

## Install the pinned native source (one-time VPS admin action)

The source is **not** downloaded from an untrusted visitor-supplied URL.
`ops/android/sync-affiliate-build-source.sh` clones the named GitHub branch
using the existing private deploy key, checks its exact SHA, validates the
`0.124.0` version and affiliate `BuildConfig` marker, and installs a
timestamped, rollback-preserving directory via the stable symlink
`/var/www/betvima-android`. It takes the same lock as the on-demand builder.
It does not copy or change the signing keystore, bets or wallets.

After an approved web deploy containing this script, execute **as root on
the actual production VPS**:

```sh
sudo bash /opt/nova-releases/<APPROVED_MAIN_SHA>/ops/android/sync-affiliate-build-source.sh
```

Use the exact revision verified in the production workflow instead of the
angle-bracket placeholder. Do not run `curl | bash` as root.

The helper also checks for Android SDK 35 + build-tools 35.0.0, sets a
`local.properties` SDK path and installs only a checksum-verified official
Gradle 8.10.2 distribution if required. A missing SDK fails with
`android_sdk_35_and_apksigner_required`; install SDK packages and retry.

### Signing requirements (must be configured privately)

A branded real-user release **cannot** be the CI debug APK. The production
web **runtime** must already receive these four environment variables from
the secure deployment signing configuration:

- `BETVIMA_ANDROID_KEYSTORE_PATH` (absolute path readable by the build account)
- `BETVIMA_ANDROID_KEYSTORE_PASSWORD`
- `BETVIMA_ANDROID_KEY_ALIAS`
- `BETVIMA_ANDROID_KEY_PASSWORD`

Never commit or paste their values. Do not create a new signing key if an
existing Android app signing identity needs to be retained. The endpoint
fails closed with `ANDROID_SIGNING_NOT_CONFIGURED` instead of publishing an
unsigned APK. Production Next.js is isolated in `/opt/nova-releases`: a
private `/var/www/nova/.env.production` file is **not** automatically
injected into its PM2 environment. The server administrator must provide
these values through its approved private runtime-secret provisioning.

`ANDROID_BUILD_TOOLS_NOT_CONFIGURED` means Gradle or `apksigner` is not
available in one of the permitted absolute paths. `APP_BUILD_FAILED`
indicates a build error; inspect private server logs without exposing
passwords. Never disable signature verification or bypass the source
version gate to suppress these errors.

### Validate a particular affiliate

After installation + signing provisioning, visit the normal download link
for an approved affiliate code. The response must contain
`Content-Type: application/vnd.android.package-archive` and a signed APK,
not JSON. Each `-PaffiliateRef=CODE` Gradle invocation embeds that affiliate
code in `BuildConfig.AFFILIATE_REFERRAL_CODE`; the server checks the
generated release BuildConfig before publishing. File names include the
source version and affiliate code. Build calls are serialized under
`.native-build.lock`.

After signing, install the personalized release on a test device and create
a **new** account via it (never reuse an existing user to test immutable
referral attribution). Check the database and the affiliate's dashboard
before distributing it. A valid signature alone is not sufficient proof
of correct attribution or Play Store signing compatibility.


## Automatic signing queue (0.125.0+)

The web download endpoint serves a cached, certificate-pinned APK immediately.
For any other approved affiliate, it writes only a zero-length <CODE>.request file
under /var/lib/betvima-affiliate-build/queue, then shows a self-refreshing
"preparing Android" page. The web service does not hold keystore secrets and
never runs Gradle. A separate systemd timer builds one request at a time
as the isolated betvimaapk user; systemd caps memory and CPU. The private
root-only signing key is copied temporarily into a private RAM directory
accessible only to that build user, then destroyed automatically.

After the reviewed production deployment, use this exact order on the VPS:

1. As root, invoke the new release's ops/android/sync-affiliate-build-source.sh.
   This validates the pinned native Git commit and installs Android 0.125.0
   without altering the website, wallets, or keystore.
2. As root, invoke the same release's ops/android/install-affiliate-apk-worker.sh.
   This installs the isolated worker and enables its systemd timer; it
   DOES NOT restart the Next.js service. The installer can be rerun to sync
   a later reviewed source revision, preserving the old workspace.
3. Verify: systemctl is-active betvima-affiliate-apk.timer
4. Test a separate APPROVED affiliate code with:
   https://betvima.com/app/affiliate/<CODE>
   The initial response may be a waiting page. It refreshes until the
   certificate-pinned APK is available for download.
5. Inspect without exposing passwords:
   journalctl -u betvima-affiliate-apk.service --no-pager -n 35

A failed build becomes a non-retrying failure marker at
/var/lib/betvima-affiliate-build/failed/<CODE>. Do not repeatedly trigger a
build that exhausted server resources. Diagnose the private root-owned
/var/lib/betvima-affiliate-build/last-build.log, fix the cause, and have an
administrator clear ONLY that affected affiliate code's failure marker.

Only reviewed source SHA 909b223b477c01d08f1561a1c3d6c17e7bec605c is installed.
The 0.124.0 APK already installed on test phones continues working; a
different APK with version 0.125.0 must be signed with the same release key
to install as an update. The public API never exposes the internal
attributionFromCookie field, while the server still persists audit
and affiliate registration records.

Do not copy signing passwords to PM2, website environment files, GitHub
repository, GitHub logs, frontend JavaScript or an APK. Keep an encrypted
off-VPS backup of the JKS and its password, and never replace the signing
identity without carefully planning device updates.
