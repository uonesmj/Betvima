import { AdminShell } from '@/components/admin/admin-shell';
import { SettingsClient } from '@/components/admin/settings-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Admin' };

export default function AdminSettingsPage() {
  return (
    <AdminShell title="Platform settings">
      <SettingsClient />
    </AdminShell>
  );
}
