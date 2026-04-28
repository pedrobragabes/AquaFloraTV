import { redirect } from 'next/navigation';

import { isAuthEnabled } from '../../lib/auth-cookie';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  if (!isAuthEnabled()) {
    redirect('/media');
  }

  return <LoginForm />;
}
