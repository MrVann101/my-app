# Supabase migration policy

## Apply order

1. Apply numbered SQL files in lexical order from `0001` through the latest migration.
2. Run `npm run verify:schema` for static coverage.
3. Run `npm run verify:live-schema` against the target project.
4. Run the live RLS and feature verification scripts before enabling the deployment.

## Production safeguards

- Take a database backup or confirm point-in-time recovery before applying migrations.
- Apply migrations to Preview before Production.
- Keep service-role credentials out of migration files and source control.
- Treat RLS policy changes as authorization changes and rerun cross-user isolation checks.

## Rollback strategy

- Prefer forward corrective migrations because destructive rollback SQL can lose user data.
- For additive tables or columns, disable the dependent feature, apply a corrective migration, and preserve existing rows.
- For policy changes, restore the previous policy in a new numbered migration and rerun RLS verification.
- For failed deployments, roll back the application version first, then reconcile the database with a forward migration.
