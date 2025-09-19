import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/register(.*)',
  '/api/auth/:path*',
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const { pathname, search, hash } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api');

  if (isApiRoute) {
    auth.protect();
    return;
  }

  const redirectPath = `${pathname}${search}${hash}`;
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('redirect_url', redirectPath);

  auth.protect({ unauthenticatedUrl: loginUrl.toString() });
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
