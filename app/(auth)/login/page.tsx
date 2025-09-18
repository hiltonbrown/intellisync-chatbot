import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/register"
        redirectUrl="/"
      />
    </div>
  );
}
