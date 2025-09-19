import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isChatApiRoute = createRouteMatcher(['/api/chat/:path*']);
const isPublicRoute = createRouteMatcher(['/', '/chat/:path*']);

export default clerkMiddleware((auth, req) => {
  if (!isChatApiRoute(req) && !isPublicRoute(req)) {
    auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
