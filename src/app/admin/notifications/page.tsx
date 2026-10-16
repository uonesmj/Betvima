import { AdminShell } from '@/components/admin/admin-shell';
import { NotificationsAdminClient } from '@/components/admin/notifications-admin-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications | BetVima Admin' };

export default function AdminNotificationsPage() {
  return (
    <AdminShell title="Notifications">
      <NotificationsAdminClient />
    </AdminShell>
  );
}
