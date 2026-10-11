#!/usr/bin/env bash
# Scaffold an admin page (server component wrapper) around a client component.
# usage: gen-admin-page.sh <route path e.g. users/[id]> <title> <ClientComponentName> <client file name>
set -euo pipefail
route="$1"; title="$2"; component="$3"; client="$4"
mkdir -p "src/app/admin/$route"
cat > "src/app/admin/$route/page.tsx" <<PAGE
import { AdminShell } from '@/components/admin/admin-shell';
import { $component } from '@/components/admin/$client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '$title · Admin' };

export default function Page({ params }: { params?: Promise<Record<string, string>> }) {
  void params;
  return (
    <AdminShell title="$title">
      <$component />
    </AdminShell>
  );
}
PAGE
echo "created src/app/admin/$route/page.tsx"
