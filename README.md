# Kakeibo - Shared Expense Tracker

Kakeibo is a resilient, shared expense tracking application built for accuracy and clarity. Designed to handle messy financial histories, it allows users to smoothly import expenses, split bills, track group balances, and settle debts with complete confidence.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Authentication:** NextAuth (Google OAuth)
- **Package Manager:** pnpm

## Setup Instructions

Follow these steps to get the project up and running locally:

### 1. Install dependencies
Make sure you have `pnpm` installed, then run:
```bash
pnpm install
```

### 2. Environment Variables
Create a `.env` file in the root of the project. You'll need the following variables configured:
```env
# Database configuration (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database"

# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Database Setup
Run the Prisma migrations to set up your PostgreSQL database schema:
```bash
pnpm db:migrate
```

### 4. Start the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the app in action!

### 5. Running Tests
Whenever you make changes to the code, please run the test suite to ensure everything is working correctly:
```bash
pnpm test
```

---

## AI Assistance Disclosure

As per the assignment requirements, I want to be fully transparent about the AI tools I leaned on. Here’s a breakdown of how different AI models assisted me throughout the development process:

- **Codex with GPT 5.4 & Claude Sonnet 4.6:** I used these models heavily at the beginning of the project to help scaffold the initial backend architecture, set up the Next.js routes, and figure out the core Prisma database schema for handling the complex math behind shared expenses and transactions.
- **Antigravity with Gemini 3.1:** This was my go-to for the frontend design! I used it to assist with the UI parts of things designing the dashboard, refining the layouts, setting up the custom Tailwind CSS themes, and polishing the user experience (like fixing table overlaps and adding smooth auto-scrolling!).
- **Deepseek V4 Flash:** I kept this model running alongside me for general coding assistance. It was incredibly helpful for rapid refactoring, quickly executing small tedious tasks, making quick UI adjustments on the fly, and acting as an extra set of eyes for general problem-solving along the way.
