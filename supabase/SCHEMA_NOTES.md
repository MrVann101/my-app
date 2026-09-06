# Bitewise schema notes

The migration set is checked against the project plan's data model by `npm run verify:schema`.

## Intentional deviations and additions

- `profiles.name` is implemented as `profiles.username`, matching the approved identity decision.
- `profiles.timezone` stores the user's automatically detected IANA timezone for local-day calculations.
- `custom_foods` is an additional private table for reusable label-derived per-gram rates.
- `custom_foods.label_source`, `label_calories`, and `label_weight_g` preserve the one-time label derivation inputs.
- `favorite_foods` stores per-gram rates and a default weight rather than a standalone editable calorie total.
- `meal_plans.goal`, `diet_type`, and `total_calories` support the approved public-plan filters; `total_calories` is refreshed from item totals by a database trigger.
- Food-log and meal-plan-item computed nutrient columns remain stored for query performance, but database triggers overwrite them from `weight_g` and per-gram rates on insert/update.
- Plan creation is separate from daily logging. `food_logs.logged_from_plan_id` is provenance only and does not cause a plan to affect a day until a later logging operation copies its items.

## Verification status

- Static table, column, policy, and trigger coverage passes with `npm run verify:schema`.
- Live RLS verification is implemented in `scripts/verify-rls.mjs` but requires a configured Supabase project and test credentials before it can be marked complete.
