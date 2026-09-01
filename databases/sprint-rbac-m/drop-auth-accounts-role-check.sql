-- Sprint RBAC-M: allow custom roles on auth_accounts
-- Drop legacy enum check that only allowed 5 builtin roles.

ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_role_check;
