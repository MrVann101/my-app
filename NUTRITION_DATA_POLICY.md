# Bitewise data policy

## Nutrition source labels

- `database`: USDA or Open Food Facts values normalized to canonical per-gram rates.
- `ai_photo` and `ai_text`: provider estimates that require user review before logging.
- `manual`: values derived from user-entered label data.
- AI and manual values are estimates and are shown with their source or confidence where the UI presents them.

## Precision

- Store nutrient rates and computed totals as numeric values without display rounding.
- Recompute totals from stored per-gram rates and weight on every server mutation.
- Display calories and gram-based nutrients rounded to the nearest whole unit.
- Display sodium in whole milligrams.
- Display per-gram calorie rates to two decimal places in editing and selection views.

## Timezones

- Store each profile's IANA timezone; do not ask users to select a timezone manually during normal use.
- Use the profile timezone for local dates, daily summaries, streaks, AI daily caps, and reminder scheduling.
- Use UTC timestamps for audit fields, provider rate-limit buckets, and server-created timestamps.
- Recalibration uses calendar dates from the stored weight logs and does not infer a timezone from the browser after onboarding.
