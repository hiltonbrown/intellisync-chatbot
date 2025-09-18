'use client';

import { useClerk } from '@clerk/nextjs';

export const SignOutForm = () => {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: '/' })}
      className="w-full px-1 py-0.5 text-left text-red-500"
    >
      Sign out
    </button>
  );
};
