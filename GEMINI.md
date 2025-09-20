# Project: Intellisync Chatbot

## Project Overview

This is a Next.js project that implements a chatbot application. It leverages the Vercel AI SDK to interact with various language models, with a default to xAI's models. The frontend is built with Next.js, React, and shadcn/ui, using Tailwind CSS for styling. Data persistence is handled by Neon Serverless Postgres, and authentication is managed through Auth.js.

The application supports features like chat history, voting on messages, creating and managing documents, and suggesting changes to documents. The database schema is defined using Drizzle ORM.

## Building and Running

### Prerequisites

- Node.js and pnpm
- Vercel CLI

### Environment Variables

Before running the application, you need to set up the environment variables defined in `.env.example`. It is recommended to use Vercel Environment Variables.

1.  Install Vercel CLI: `npm i -g vercel`
2.  Link your local instance with your Vercel and GitHub accounts: `vercel link`
3.  Download your environment variables: `vercel env pull`

### Installation

```bash
pnpm install
```

### Running the Application

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Database

The project uses Drizzle ORM for database management. The following scripts are available:

-   `pnpm db:generate`: Generate database migration files.
-   `pnpm db:migrate`: Apply database migrations.
-   `pnpm db:studio`: Open the Drizzle DB studio.

### Testing

The project uses Playwright for end-to-end testing.

```bash
pnpm test
```

## Development Conventions

### Linting and Formatting

The project uses Biome for linting and formatting.

-   `pnpm lint`: Lint the codebase.
-   `pnpm format`: Format the codebase.
-   `pnpm lint:fix`: Lint and format the codebase.

### Code Style

The codebase is written in TypeScript and follows standard React and Next.js conventions. The use of shadcn/ui and Tailwind CSS suggests a utility-first approach to styling.

### Components

Components are organized in the `components` directory. Reusable UI components are located in `components/ui`.

### State Management

The project uses a combination of React hooks, SWR for data fetching, and `useChat` from the AI SDK for managing chat state.
