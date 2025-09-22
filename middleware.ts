import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/register(.*)',
  '/api/auth/:path*',
  '/api/models',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const { pathname, search, hash } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api');

  if (isApiRoute) {
    await auth.protect();
    return;
  }

  const redirectPath = `${pathname}${search}${hash}` || '/';
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('redirect_url', redirectPath);

  await auth.protect({ unauthenticatedUrl: loginUrl.toString() });
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
