import { SignOutButton } from "@clerk/nextjs";

export const SignOutForm = () => {
  return (
    <SignOutButton>
      <button className="w-full px-1 py-0.5 text-left text-red-500">
        Sign out
      </button>
    </SignOutButton>
  );
};