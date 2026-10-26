#!/usr/bin/env bash
# One-time, self-hosted Ed25519 identity for the BetVima casino Edge SHADOW.
# This is NOT the Cloudflare callback signing key or provider salt key.
# Never put the PRIVATE KEY into GitHub, Supabase public env, Termius transcript
# or a ChatGPT message. Only the DER public key is printed.
set -euo pipefail
umask 077

if [[ "$EUID" -ne 0 ]]; then
  echo 'STOP_RUN_AS_ROOT'
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo 'STOP_OPENSSL_NOT_INSTALLED'
  exit 1
fi

dir='/etc/betvima/edge-bridge'
private="$dir/edge-bridge-shadow-ed25519.pem"

# Intentional isolated private-key creation only. No site, PM2, DB, Nginx,
# customer wallet, provider credentials, or environment variables are touched.
install -d -m 0700 -o root -g root "$dir"
if [[ -e "$private" ]]; then
  if [[ ! -f "$private" || -L "$private" ]]; then
    echo 'STOP_EXISTING_PRIVATE_KEY_NOT_REGULAR_FILE'
    exit 1
  fi
  echo 'EXISTING_EDGE_BRIDGE_PRIVATE_KEY_REUSED'
else
  tmp="$(mktemp "$dir/.ed25519-XXXXXXXX")"
  trap 'rm -f -- "$tmp"' EXIT
  openssl genpkey -algorithm Ed25519 -out "$tmp" >/dev/null 2>&1
  chmod 0600 "$tmp"
  chown root:root "$tmp"
  if [[ -e "$private" ]]; then
    echo 'STOP_PRIVATE_KEY_APPEARED_CONCURRENTLY'
    exit 1
  fi
  mv -- "$tmp" "$private"
  trap - EXIT
  echo 'NEW_ED25519_SHADOW_KEY_CREATED'
fi

chmod 0600 "$private"
chown root:root "$private"
openssl pkey -in "$private" -noout -check >/dev/null 2>&1 || {
  echo 'STOP_INVALID_PRIVATE_KEY'; exit 1;
}
public="$(openssl pkey -in "$private" -pubout -outform DER | base64 -w0)"
length="$(printf '%s' "$public" | wc -c)"
if [[ -z "$public" || "$length" -lt 50 || "$length" -gt 160 ]]; then
  echo 'STOP_UNEXPECTED_PUBLIC_KEY_SIZE'
  exit 1
fi
echo 'ED25519_PUBLIC_SPKI_B64='"$public"
echo 'PRIVATE_KEY_REMAINS_ON_VPS_ROOT_ONLY'
echo 'PRODUCTION_CALLBACK_UNCHANGED_PORT_3098'
echo 'NO_FINANCIAL_OPERATIONS_PERFORMED'
