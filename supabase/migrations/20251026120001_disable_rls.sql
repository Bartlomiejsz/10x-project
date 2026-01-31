-- migration: disable row level security
-- purpose: disable rls on all tables and drop insert/update/delete policies
-- affected objects: transaction_types, budgets, transactions
-- notes:
--   * this migration disables rls for simplified development/testing
--   * re-enable rls before production deployment

begin;

-- 1. disable row level security on all tables
alter table transaction_types disable row level security;
alter table budgets disable row level security;
alter table transactions disable row level security;

-- 2. drop insert/update/delete policies on transaction_types
drop policy if exists transaction_types_insert_authenticated on transaction_types;
drop policy if exists transaction_types_insert_anon on transaction_types;
drop policy if exists transaction_types_update_authenticated on transaction_types;
drop policy if exists transaction_types_update_anon on transaction_types;
drop policy if exists transaction_types_delete_authenticated on transaction_types;
drop policy if exists transaction_types_delete_anon on transaction_types;

-- 3. drop insert/update/delete policies on budgets
drop policy if exists budgets_insert_authenticated on budgets;
drop policy if exists budgets_insert_anon on budgets;
drop policy if exists budgets_update_authenticated on budgets;
drop policy if exists budgets_update_anon on budgets;
drop policy if exists budgets_delete_authenticated on budgets;
drop policy if exists budgets_delete_anon on budgets;

-- 4. drop insert/update/delete policies on transactions
drop policy if exists transactions_insert_authenticated on transactions;
drop policy if exists transactions_insert_anon on transactions;
drop policy if exists transactions_update_authenticated on transactions;
drop policy if exists transactions_update_anon on transactions;
drop policy if exists transactions_delete_authenticated on transactions;
drop policy if exists transactions_delete_anon on transactions;

commit;