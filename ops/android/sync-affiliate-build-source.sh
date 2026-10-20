#!/usr/bin/env bash
# One-time, administrator-reviewed installation of the exact tested Android source.
# This does not deploy web/DB code, change keys, or publish unsigned APKs.
set -Eeuo pipefail
umask 027

REPO='git@github.com:uonesmj/Betvima.git'
BRANCH='feat/android-134-my-bets-tickets-20261020'
SHA='0ea6675bedbc79a18258a1cc4c4452903e23032d'
BASE='/var/www/betvima-android-releases'
INSTALL='/var/www/betvima-android'
DOWNLOADS='/var/www/nova/public/downloads/affiliate-app'
OWNER='novaadmin'
stage=''

fail() { printf 'affiliate_android_setup_failed: %s\n' "$1" >&2; exit 1; }
cleanup() { if [[ -n "${stage}" && -d "${stage}" ]]; then rm -rf -- "${stage}"; fi; }
trap cleanup EXIT

[[ "$(id -u)" == '0' ]] || fail 'administrator_required'
id "${OWNER}" >/dev/null 2>&1 || fail 'native_build_account_missing'
for cmd in git flock rsync install stat; do command -v "$cmd" >/dev/null || fail "missing_${cmd}"; done
[[ -d /var/www/nova ]] || fail 'expected_web_directory_missing'
mkdir -p "${BASE}" "${DOWNLOADS}"
# The native build account must traverse this root-controlled release directory.
chmod 0755 "${BASE}"
# Only this leaf output directory is writable by the native build account.
chown root:root "${DOWNLOADS}"
# Use the same lock as the per-partner on-demand APK builder.
if [[ ! -e "${DOWNLOADS}/.native-build.lock" ]]; then
  install -o root -g root -m 0640 /dev/null "${DOWNLOADS}/.native-build.lock"
fi
chown root:root "${DOWNLOADS}/.native-build.lock"
chmod 0640 "${DOWNLOADS}/.native-build.lock"
exec 9>>"${DOWNLOADS}/.native-build.lock"
flock -w 180 9 || fail 'native_builder_is_busy'

# Existing production infrastructure provisions a pinned GitHub SSH deploy key.
if [[ -f /root/.ssh/betvima_github ]]; then
  export GIT_SSH_COMMAND='ssh -i /root/.ssh/betvima_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'
fi
stage="$(mktemp -d "${BASE}/.stage-XXXXXXXX")"
git clone --quiet --depth 1 --single-branch --branch "${BRANCH}" "${REPO}" "${stage}/repo" \
  || fail 'source_clone_failed'
actual="$(git -C "${stage}/repo" rev-parse HEAD)"
if [[ "${actual}" != "${SHA}" ]]; then
  # Native development can move ahead while an approved web release is
  # deployed. Fetch the exact reviewed commit instead of rejecting its
  # pinned revision or silently installing a newer, unreviewed HEAD.
  git -C "${stage}/repo" fetch --quiet --depth 1 origin "${SHA}" \
    || fail 'approved_source_commit_fetch_failed'
  git -C "${stage}/repo" checkout --quiet --detach "${SHA}" \
    || fail 'approved_source_commit_checkout_failed'
  actual="$(git -C "${stage}/repo" rev-parse HEAD)"
fi
[[ "${actual}" == "${SHA}" ]] || fail 'source_revision_mismatch'
src="${stage}/repo/android-native"
[[ -f "${src}/app/build.gradle.kts" ]] || fail 'android_project_not_found'
grep -Eq '^[[:space:]]*versionCode[[:space:]]*=[[:space:]]*134[[:space:]]*$' "${src}/app/build.gradle.kts" \
  || fail 'expected_android_version_code_missing'
grep -Eq '^[[:space:]]*versionName[[:space:]]*=[[:space:]]*"0\.134\.0"[[:space:]]*$' "${src}/app/build.gradle.kts" \
  || fail 'expected_android_version_name_missing'
grep -Fq 'AFFILIATE_REFERRAL_CODE' "${src}/app/build.gradle.kts" \
  || fail 'affiliate_attribution_build_config_missing'
grep -Fq 'BETVIMA_ANDROID_KEYSTORE_PATH' "${src}/app/build.gradle.kts" \
  || fail 'signed_release_configuration_missing'

# Use Gradle 8.10.2, the same version tested by Android CI.
# If absent, install only after verifying the official binary SHA-256.
if [[ ! -x /opt/gradle/bin/gradle && ! -x /opt/gradle-8.10.2/bin/gradle ]]; then
  for tool in curl unzip sha256sum; do command -v "${tool}" >/dev/null || fail "missing_${tool}"; done
  zip="${stage}/gradle-8.10.2-bin.zip"
  curl --fail --location --silent --show-error --retry 2 \
    --output "${zip}" 'https://services.gradle.org/distributions/gradle-8.10.2-bin.zip' \
    || fail 'gradle_download_failed'
  printf '%s  %s\n' \
    '31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26' "${zip}" \
    | sha256sum -c --status || fail 'gradle_checksum_mismatch'
  mkdir -p /opt/betvima-gradle-distributions
  unzip -q "${zip}" -d /opt/betvima-gradle-distributions || fail 'gradle_unpack_failed'
  [[ -x /opt/betvima-gradle-distributions/gradle-8.10.2/bin/gradle ]] \
    || fail 'gradle_distribution_incomplete'
  if [[ ! -e /opt/gradle ]]; then
    ln -s /opt/betvima-gradle-distributions/gradle-8.10.2 /opt/gradle
  fi
fi

sdk=''
for candidate in /usr/local/lib/android/sdk /opt/android-sdk /usr/lib/android-sdk /home/novaadmin/Android/Sdk; do
  if [[ -d "${candidate}/platforms/android-35" && -x "${candidate}/build-tools/35.0.0/apksigner" ]]; then
    sdk="${candidate}"; break
  fi
done
[[ -n "${sdk}" ]] || fail 'android_sdk_35_and_apksigner_required'

dest="${BASE}/${SHA}"
if [[ -d "${dest}" && ! -f "${dest}/local.properties" ]]; then
  printf 'sdk.dir=%s\n' "${sdk}" > "${dest}/local.properties"
  chown "${OWNER}:${OWNER}" "${dest}/local.properties"
  chmod 0600 "${dest}/local.properties"
fi

if [[ ! -d "${dest}" ]]; then
  mkdir -p "${stage}/source"
  rsync -a --exclude='.git' --exclude='.gradle' --exclude='build' \
    "${src}/" "${stage}/source/" || fail 'source_copy_failed'
  printf '%s\n' "${SHA}" > "${stage}/source/.betvima-native-commit"
  printf 'sdk.dir=%s\n' "${sdk}" > "${stage}/source/local.properties"
  # The build account must be able to generate outputs without writing into
  # the web checkout or touching the existing signing keystore.
  chown -R "${OWNER}:${OWNER}" "${stage}/source"
  chmod -R u+rwX,go-rwx "${stage}/source"
  mv -- "${stage}/source" "${dest}"
fi

# An old real directory is retained for rollback rather than deleted.
if [[ -e "${INSTALL}" && ! -L "${INSTALL}" ]]; then
  backup="${INSTALL}.before-134-$(date -u +%Y%m%dT%H%M%SZ)"
  mv -- "${INSTALL}" "${backup}"
  printf 'native_source_previous_preserved=%s\n' "${backup}"
fi
tmpLink="${INSTALL}.new.$$"
ln -s "${dest}" "${tmpLink}"
mv -Tf -- "${tmpLink}" "${INSTALL}"
[[ -f "${INSTALL}/app/build.gradle.kts" ]] || fail 'new_native_source_not_resolved'

# The web process runs as novaadmin; verify it can traverse the source.
su -s /bin/sh -c "test -r '${INSTALL}/app/build.gradle.kts'" "${OWNER}" \
  || fail 'web_account_cannot_read_native_source'

printf 'android_source_installed=v0.134.0\n'
printf 'android_source_revision=%s\n' "${SHA}"
printf 'native_source_path=%s\n' "${INSTALL}"
# The installed web route has separate mandatory guards for signing credentials,
# a compatible Gradle toolchain and a functional apksigner. Do not bypass them.
printf 'next_check=validate_release_signing_and_toolchain_on_vps\n'
