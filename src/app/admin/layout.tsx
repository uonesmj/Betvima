import './admin.css';

// Admin-only styles are scoped to .bv-admin; no public or Android styling changes.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
