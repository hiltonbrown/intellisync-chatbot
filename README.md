# IntelliSync

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-Apache_2.0-blue) ![Version](https://img.shields.io/badge/version-3.1.0-orange)

IntelliSync is an intelligent, multimodal AI chat interface optimized for business workflows, real-time artifact generation, and deep integration with financial systems like Xero.

## About

IntelliSync transforms standard AI chat interactions into actionable business workflows. Unlike generic chatbots, IntelliSync is designed to understand and manipulate business data directly. It combines the conversational power of Large Language Models (LLMs) like Google Gemini and Claude with structured data from Xero and other integrations. This allows users to not only ask questions but also generate financial reports, visualize data in interactive spreadsheets, and automate routine tasks within a single, secure interface.

## Key Features

*   **Generative UI Artifacts:** Dynamically generate and edit rich content formats including code snippets, interactive documents, and spreadsheets directly within the chat stream.
*   **Deep Business Integration:** Seamlessly connect with Xero to access financial data, handle webhooks for real-time updates, and perform actions like syncing contacts and invoices.
*   **Multimodal Capabilities:** Support for mixed-media interactions, allowing users to upload images and documents for analysis alongside text-based queries using advanced models like Gemini 2.5 Flash and Gemini 3 Pro.
*   **Personalized Workflows:** Adaptive user experience that leverages historical context and user preferences to tailor responses and interface elements to individual business needs.
*   **Robust Architecture:** Built on Next.js 16 (App Router), Drizzle ORM, and the Vercel AI SDK, ensuring a scalable, type-safe, and high-performance foundation.

## Installation

Ensure you have Node.js 18+ and pnpm installed.

```bash
# Clone the repository
git clone https://github.com/your-org/intellisync.git

# Navigate to the project directory
cd intellisync

# Install dependencies
pnpm install
```

## Quick Start

To see IntelliSync in action, start the development server:

```bash
# Start the local development server
pnpm dev
```

Open your browser and navigate to `http://localhost:3000`. You will be greeted by the authentication screen. After logging in, you can start a new chat session. Try asking the AI to "Analyze the latest financial report" or "Create a spreadsheet for Q1 expenses" to trigger the artifact generation features.

## Configuration

IntelliSync requires several environment variables to function, particularly for database access, authentication, and third-party integrations. Create a `.env.local` file in the root directory based on the `.env.example` template.

### Required Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Connection string for your Postgres database (e.g., Neon). |
| `AI_GATEWAY_API_KEY` | API key for the Vercel AI Gateway (if not deploying on Vercel). |
| `CLERK_SECRET_KEY` | Secret key for Clerk authentication. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key for Clerk authentication. |
| `XERO_CLIENT_ID` | Client ID for the Xero application. |
| `XERO_CLIENT_SECRET` | Client Secret for the Xero application. |
| `XERO_REDIRECT_URI` | Redirect URI for Xero OAuth (e.g., `http://localhost:3000/api/xero/callback`). |
| `TOKEN_ENC_KEY_HEX` | 64-character hex string for encrypting sensitive tokens. |

## Contributing

We welcome contributions to IntelliSync! Please follow these steps to contribute:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

Please ensure all tests pass (`pnpm test`) and code is formatted (`pnpm format`) before submitting.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.