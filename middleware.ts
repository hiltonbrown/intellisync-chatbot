import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isChatApiRoute = createRouteMatcher(['/api/chat/:path*']);

export default clerkMiddleware((auth, req) => {
  if (!isChatApiRoute(req)) {
    auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
