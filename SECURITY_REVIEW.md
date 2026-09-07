# Security review

Review date: 2026-09-07

## Verified

- `npm audit --audit-level=moderate` reports zero vulnerabilities.
- Authenticated API routes use Supabase server sessions and reject missing users.
- User-owned queries are scoped by `user_id`; food-log edit/delete routes also enforce ownership directly.
- Public meal-plan visibility is gated by RLS and deletion-state checks.
- Cron routes require `CRON_SECRET` before using the service-role client.
- AI provider keys and the service-role key are accessed only from server-side modules.
- AI image uploads enforce JPEG, PNG, WebP, and 10 MB limits before provider calls.
- AI responses are parsed through strict Zod schemas before use.
- CSV exports are authenticated, ownership-scoped, streamed, escaped, and protected against spreadsheet formula injection.
- Offline API writes are not queued or reported as successful when the network is unavailable.

## Residual deployment checks

- Configure separate Preview and Production secrets in Vercel; never commit `.env.local`.
- Confirm `CRON_SECRET` is identical between Vercel Cron and deployment runtime.
- Apply all Supabase migrations through `0014_notification_preferences.sql` and run `npm run verify:live-schema`.
- Confirm Storage bucket policies for `food-photos` match the intended upload/read paths.
- Review Vercel and Supabase logs for provider failures, cron failures, and service-role access.
- Run the documented deployment smoke checklist with a disposable test account.
