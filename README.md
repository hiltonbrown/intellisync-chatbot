# Intellisync Chatbot 🚀

**Your team’s AI-powered workspace: chat, documents, and collaboration made simple.**

## Table of Contents

* [Overview](#overview)
* [Features](#features)
* [Getting Started (Hosted Version)](#getting-started-hosted-version)
* [For Developers](#for-developers)
* [Usage Examples](#usage-examples)
* [Contributing](#contributing)
* [FAQ / Troubleshooting](#faq--troubleshooting)
* [Roadmap](#roadmap)
* [License](#license)

## Overview

Most teams and small businesses don’t want the hassle of deploying and maintaining infrastructure just to use an AI assistant. **Intellisync Chatbot** solves this by offering a **fully hosted version** that you can start using immediately. Simply sign up, log in, connect your accounting software, and begin chatting with powerful AI tools, managing documents, and collaborating with your team.

For developers, Intellisync can also be deployed locally or to Vercel for custom use cases—but the primary focus is on **end users accessing the hosted service**.

## Features

* 🔐 **Clerk authentication** for secure logins
* 🗂 **Persistent chat history** stored in the cloud
* 📄 **Document management**: create, edit, and share documents
* 👍 **Voting system** for messages and document suggestions
* 🎨 **Modern UI**: sleek and mobile-friendly
* ⚡ **Fast AI interactions** powered by the Vercel AI SDK

## Getting Started (Hosted Version)

1. **Visit the hosted app**: [https://yourapp.com](https://yourapp.com)
2. **Sign up or log in** with Clerk authentication
3. **Start chatting** with AI, create documents, and collaborate instantly—no setup required

## For Developers

If you want to run Intellisync locally or extend it:

```bash
# 1. Clone the repo
git clone https://github.com/<org>/<repo>.git
cd <repo>

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in required keys: Postgres, Clerk, Vercel

# Example Clerk keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# 4. Run locally
pnpm dev
# App runs at http://localhost:3000
```

## Usage Examples

### Chat with the AI

```typescript
import { useChat } from "ai/react";

const { messages, sendMessage } = useChat();
sendMessage("Summarise last quarter’s sales report");
```

## Contributing

We welcome contributions from developers of all backgrounds. Fork the repo, create a branch, and submit a pull request. Please run `pnpm lint` before submitting.

## FAQ / Troubleshooting

**Q: Do I need to deploy anything myself?**
A: No. The hosted version is ready to use immediately.

**Q: How do I invite my team?**
A: Log in to the hosted app and use the team management settings.

**Q: I’m a developer—can I customise it?**
A: Yes, see [For Developers](#for-developers).

## Roadmap

* [ ] Enhanced collaboration features (mentions, roles)
* [ ] Export chats and documents to PDF/CSV
* [ ] Plugin marketplace for custom tools
* [ ] More AI model integrations (Anthropic, Mistral, etc.)

## License

This project is licensed under the [MIT License](LICENSE).

## Visuals

* 🖼 **Screenshots**: Coming soon...
* 🎥 **GIF demo**: Coming soon...
* 🗺 **Architecture diagram**: Coming soon...
