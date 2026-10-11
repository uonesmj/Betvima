'use client';

import { useRouter } from 'next/navigation';
import { AuthSheet } from '@/components/account/auth-sheet';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <AuthSheet
      mode="register"
      onClose={() => router.push('/')}
    />
  );
}
