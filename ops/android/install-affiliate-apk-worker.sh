#!/usr/bin/env bash
# VPS admin install: isolated systemd timer; never restarts PM2 or web.
set -Eeuo pipefail
umask 027
ROOT=/var/lib/betvima-affiliate-build
SOURCE=/var/www/betvima-android
DOWNLOADS=/var/www/nova/public/downloads/affiliate-app
WORKER="$(dirname "$0")/affiliate_apk_worker.py"
fail() { echo "affiliate_worker_install_failed=$1" >&2; exit 1; }
[[ "$(id -u)" == 0 ]] || fail root_required
for cmd in rsync systemctl useradd python3 flock setpriv; do command -v "$cmd" >/dev/null || fail "missing_$cmd"; done
[[ -s /etc/betvima/android-signing/betvima-release.jks ]] || fail signing_key_missing
[[ -s /etc/betvima/android-signing/release.pass ]] || fail signing_password_missing
[[ -x /opt/gradle/bin/gradle ]] || fail gradle_missing
[[ -x /opt/android-sdk/build-tools/35.0.0/apksigner ]] || fail apksigner_missing
[[ -f "$SOURCE/.betvima-native-commit" ]] || fail native_revision_unverified
[[ -f "$SOURCE/app/build.gradle.kts" ]] || fail native_source_missing
grep -Eq '^[[:space:]]*versionCode[[:space:]]*=[[:space:]]*125[[:space:]]*$' "$SOURCE/app/build.gradle.kts" || fail expected_version_code_125_missing
grep -Eq '^[[:space:]]*versionName[[:space:]]*=[[:space:]]*"0\.125\.0"[[:space:]]*$' "$SOURCE/app/build.gradle.kts" || fail expected_version_125_missing
[[ "$(cat "$SOURCE/.betvima-native-commit")" == "909b223b477c01d08f1561a1c3d6c17e7bec605c" ]] || fail native_sha_unapproved
[[ "$(stat -c '%u' /etc/betvima/android-signing)" == 0 ]] || fail signing_path_owner_invalid

id betvimaapk >/dev/null 2>&1 || useradd --system --home-dir "$ROOT/home" --shell /usr/sbin/nologin --no-create-home betvimaapk
id novaadmin >/dev/null 2>&1 || fail web_user_missing
install -d -o root -g root -m 0755 "$ROOT"
install -d -o root -g root -m 0755 "$ROOT/failed"
install -d -o root -g root -m 0755 "$ROOT/running"
install -d -o novaadmin -g novaadmin -m 0700 "$ROOT/queue"
install -d -o betvimaapk -g betvimaapk -m 0700 "$ROOT/home" "$ROOT/home/.gradle"
install -d -o root -g root -m 0755 "$DOWNLOADS"
if [[ ! -e "$DOWNLOADS/.native-build.lock" ]]; then
  install -o root -g root -m 0640 /dev/null "$DOWNLOADS/.native-build.lock"
fi
[[ -f "$DOWNLOADS/.native-build.lock" && ! -L "$DOWNLOADS/.native-build.lock" ]] || fail unsafe_lockfile
chown root:root "$DOWNLOADS/.native-build.lock"
chmod 0640 "$DOWNLOADS/.native-build.lock"
exec 9>>"$DOWNLOADS/.native-build.lock"
flock -w 180 -x 9 || fail build_running

stage="$(mktemp -d "$ROOT/.workspace.XXXXXXXX")"
cleanup() { if [[ -n "$stage" && -d "$stage" ]]; then rm -rf -- "$stage"; fi; }
trap cleanup EXIT
rsync -a --exclude='.git' --exclude='.gradle' --exclude='build' "$SOURCE/" "$stage/" || fail source_copy_failed
[[ "$(cat "$stage/.betvima-native-commit")" == "909b223b477c01d08f1561a1c3d6c17e7bec605c" ]] || fail invalid_stage_revision
chown -R betvimaapk:betvimaapk "$stage"
chmod 0700 "$stage"
if [[ -d "$ROOT/workspace" ]]; then
  backup="$ROOT/workspace.before-125-$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$ROOT/workspace" "$backup"
  echo "previous_android_workspace=$backup"
fi
mv "$stage" "$ROOT/workspace"
stage=''
install -d -o root -g root -m 0755 /usr/local/libexec
install -o root -g root -m 0750 "$WORKER" /usr/local/libexec/betvima-affiliate-apk-worker.py

cat > /etc/systemd/system/betvima-affiliate-apk.service <<'UNIT'
[Unit]
Description=Isolated affiliate APK builder
After=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/python3 /usr/local/libexec/betvima-affiliate-apk-worker.py
WorkingDirectory=/var/lib/betvima-affiliate-build
TimeoutStartSec=16min
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
ProtectKernelModules=true
MemoryMax=3G
MemorySwapMax=3G
TasksMax=96
CPUQuota=120%
Nice=15
IOSchedulingClass=idle
StandardOutput=journal
StandardError=journal
UNIT
cat > /etc/systemd/system/betvima-affiliate-apk.timer <<'UNIT'
[Unit]
Description=Poll the affiliate APK queue

[Timer]
OnBootSec=45s
OnUnitInactiveSec=30s
AccuracySec=10s
Unit=betvima-affiliate-apk.service

[Install]
WantedBy=timers.target
UNIT
chmod 0644 /etc/systemd/system/betvima-affiliate-apk.service /etc/systemd/system/betvima-affiliate-apk.timer
systemctl daemon-reload
systemctl enable --now betvima-affiliate-apk.timer
echo AFFILIATE_AUTO_APK_WORKER_INSTALLED
echo native_version=0.125.0
echo web_pm2_untouched=true
echo "timer_status=$(systemctl is-active betvima-affiliate-apk.timer)"
