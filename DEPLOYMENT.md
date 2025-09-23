# Deployment Guide

## Environment Variables

### Required for Production
- `OPENROUTER_API_KEY` - API key for OpenRouter AI service
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication public key
- `CLERK_SECRET_KEY` - Clerk authentication secret key
- `AUTH_SECRET` - Authentication secret for session encryption
- `POSTGRES_URL` - PostgreSQL database connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

### Optional
- `OPENROUTER_BASE_URL` - Custom OpenRouter API base URL
- `NEXT_PUBLIC_APP_URL` - Application base URL
- `AI_GATEWAY_API_KEY` - Additional AI gateway API key
- `REDIS_URL` - Redis cache connection string
- `CLERK_WEBHOOK_SECRET` - Clerk webhook verification secret

## Build Process

### Development
```bash
pnpm dev
```

### Production Build
```bash
# With database migrations (requires POSTGRES_URL)
pnpm build

# Without database migrations (for Vercel build process)
pnpm build:skip-migrate
```

### Database Migrations
For production deployments, run migrations separately:
```bash
pnpm db:migrate
```

## Vercel Deployment Notes

1. The build script automatically skips database migrations if `POSTGRES_URL` is not available during build
2. Run migrations separately after deployment using the Vercel CLI or dashboard
3. Ensure all required environment variables are configured in the Vercel project settings
4. The middleware handles authentication routing correctly for both public and protected API routes

## API Route Organization

- `/api/models` - Public endpoint for available AI models
- `/api/clerk/webhook` - Clerk authentication webhooks
- `/api/chat/save-model` - Public model preference saving
- `/ping` - Health check endpoint

All other API routes under `/(chat)/api/` require authentication.