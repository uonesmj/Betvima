import { MobileAdmin } from '@/components/admin/mobile-admin';
import './mobile-admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'BetVima · Admin Mobile', robots: { index: false, follow: false } };
export default function AdminMobilePage() { return <MobileAdmin />; }
