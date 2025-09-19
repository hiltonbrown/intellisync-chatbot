'use client';

import { SignUp } from '@clerk/nextjs';
import { useMemo } from 'react';
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

export default function Page() {
  const redirectUrl = useRedirectUrl();
  const redirectQuery =
    redirectUrl && redirectUrl !== '/'
      ? `?redirect_url=${encodeURIComponent(redirectUrl)}`
      : '';

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <SignUp
        path="/register"
        routing="path"
        signInUrl={`/login${redirectQuery}`}
        redirectUrl={redirectUrl}
      />
    </div>
  );
}
