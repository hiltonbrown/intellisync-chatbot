'use client';

import { SignIn } from '@clerk/nextjs';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

function useRedirectUrl() {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const redirectParam = searchParams.get('redirect_url');

    if (redirectParam?.startsWith('/')) {
      return redirectParam;
    }

    return '/';
  }, [searchParams]);
}

function LoginForm() {
  const redirectUrl = useRedirectUrl();
  const redirectQuery =
    redirectUrl && redirectUrl !== '/'
      ? `?redirect_url=${encodeURIComponent(redirectUrl)}`
      : '';

  return (
    <SignIn
      path="/login"
      routing="path"
      signUpUrl={`/register${redirectQuery}`}
      redirectUrl={redirectUrl}
    />
  );
}

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <Suspense
        fallback={
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/register"
            redirectUrl="/"
          />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
