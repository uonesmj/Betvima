'use client';

import { useRouter } from 'next/navigation';
import { AuthSheet } from '@/components/account/auth-sheet';

export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthSheet
      mode="login"
      onClose={() => router.push('/')}
    />
  );
}
