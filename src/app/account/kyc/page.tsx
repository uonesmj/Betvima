import { redirect } from 'next/navigation';

// Identity documents are now exchanged in the existing support conversation.
// Keep old settings/notification deep links working without a second upload form.
export const dynamic = 'force-dynamic';
export default function VerificationPage() {
  redirect('/support');
}
