# Bitewise

Bitewise is a mobile-first calorie and fitness tracking app built with Next.js.

The Next.js application lives in `my-app/`.

## Getting Started

From the `my-app/` directory, install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.
Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` for local development. Keep all values empty until the corresponding service is configured. Variables prefixed with `NEXT_PUBLIC_` are safe for browser use; all other secrets must remain server-side.

Required services and setup are documented in `BITEWISE_PROJECT_PLAN.md` at the workspace root.

## Supabase setup

Create a Supabase project before enabling authenticated features. Database migrations, RLS policies, Auth configuration, and Storage setup will be added under the implementation plan's Phase 1 database and authentication tasks.

## Deployment

Import the repository into Vercel and set `my-app/` as the project root directory. Use the standard Next.js framework preset, install dependencies with `npm install`, and build with `npm run build`. Configure Preview and Production environment variables separately.

Initial deployment smoke check:

1. Open the deployed app shell.
2. Confirm the browser receives no server-only environment variable values.
3. Confirm protected routes reject unauthenticated requests once they exist.
4. Open the app at phone, tablet, and desktop widths; confirm bottom navigation, forms, charts, and cards do not overflow.
5. Confirm `/api/cron/rollup-summaries`, `/api/cron/purge-detailed-logs`, `/api/cron/purge-photos`, `/api/cron/process-deletions`, and `/api/cron/deletion-reminders` return `401` without the configured `CRON_SECRET`.
6. Confirm the same cron routes succeed from Vercel Cron and appear in Vercel function logs.
7. Confirm the `food-photos` Storage bucket exists and the production Supabase migrations are applied through `0014_notification_preferences.sql`.
8. Sign in with a test account, verify onboarding, food logging, meal-plan logging, CSV export, deletion cancellation, and notification preference changes.
9. Switch the browser offline and confirm the offline banner appears and save actions report that writes are paused.

Automated local smoke check (start the app first):

```bash
BITEWISE_TEST_BASE_URL=http://localhost:3100 npm run smoke:check
```

## Project references

- [Bitewise project plan](../BITEWISE_PROJECT_PLAN.md)
- [Bitewise implementation plan](../BITEWISE_IMPLEMENTATION_PLAN.md)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:


You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
