-- migration: initial homebudget schema (mvp)
-- purpose: create core types, tables, constraints, triggers, seed data and row level security policies
-- affected objects: type ai_status, function set_updated_at, tables (transaction_types, budgets, transactions), indexes, triggers, rls policies
-- notes:
--   * all identifiers and sql kept lowercase per project convention
--   * rls enabled on every table; explicit allow/deny policies per role (anon, authenticated) and per command (select/insert/update/delete)
--   * policies for disallowed operations explicitly return false for clarity and future auditing
--   * seed for transaction_types uses on conflict do nothing for idempotency
--   * destructive operations (none in this initial migration) would be heavily commented; keep future drops reviewed carefully
--   * adjust policies when multi-household tenancy is introduced (see design doc)

begin;

-- ensure required extension for uuid generation (supabase usually pre-installs pgcrypto, guard with if not exists)
create extension if not exists pgcrypto;

-- 1. custom enum type for ai classification status
create type ai_status as enum ('success','fallback','error');

-- 2. utility function to set updated_at before row update
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql security definer;
comment on function set_updated_at() is 'trigger helper: updates updated_at timestamp to now() on row modifications';

-- 3. transaction_types dictionary table (static set of spending categories)
create table if not exists transaction_types (
  id serial primary key,
  code text not null unique,
  name text not null,
  position smallint not null check (position >= 0 and position < 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table transaction_types is 'dictionary of spending / classification categories';
comment on column transaction_types.code is 'stable unique code used by application logic';
create index if not exists idx_transaction_types_position on transaction_types(position);
create trigger trg_transaction_types_set_updated
  before update on transaction_types for each row execute function set_updated_at();
alter table transaction_types enable row level security;

-- 4. budgets table (monthly budget per category; composite primary key)
create table if not exists budgets (
  month_date date not null,
  type_id int not null references transaction_types(id) on update cascade on delete restrict,
  amount numeric(12,2) not null check (amount >= 0 and amount < 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (month_date, type_id)
);
comment on table budgets is 'monthly planned budget amount per category';
comment on column budgets.month_date is 'first day of month (yyyy-mm-01) used for partition-like filtering';
create trigger trg_budgets_set_updated
  before update on budgets for each row execute function set_updated_at();
alter table budgets enable row level security;

-- 5. transactions table (expense ledger)
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on update cascade on delete restrict,
  type_id int not null references transaction_types(id) on update cascade on delete restrict,
  amount numeric(12,2) not null check (amount > 0 and amount < 100000),
  description varchar(255) not null check (char_length(description) <= 255),
  date date not null check (date >= date '2000-01-01'),
  ai_status ai_status,
  ai_confidence smallint check (ai_confidence between 0 and 100),
  is_manual_override boolean not null default false,
  import_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table transactions is 'record of individual expense transactions';
comment on column transactions.ai_status is 'classification status (null if manual)';
comment on column transactions.ai_confidence is '0..100 confidence for ai classification';
comment on column transactions.is_manual_override is 'true if user manually changed ai suggested category';
comment on column transactions.import_hash is 'md5(date+amount+description) used for duplicate detection (not unique)';
create index if not exists idx_transactions_date_type on transactions(date, type_id);
create index if not exists idx_transactions_user_date on transactions(user_id, date);
create index if not exists idx_transactions_import_hash on transactions(import_hash);
create index if not exists idx_transactions_type on transactions(type_id);
create index if not exists idx_transactions_date on transactions(date);
create trigger trg_transactions_set_updated
  before update on transactions for each row execute function set_updated_at();
alter table transactions enable row level security;

-- 6. seed static categories (idempotent: on conflict do nothing)
-- note: codes kept uppercase to match db-plan and ease usage as stable constants in application code
insert into transaction_types (code, name, position) values
  ('GROCERY','Spożywcze',1),
  ('HOME','Dom',2),
  ('HEALTH_BEAUTY','Zdrowie i Uroda',3),
  ('CAR','Samochód',4),
  ('FASHION','Moda',5),
  ('ENTERTAINMENT','Rozrywka i Okazje',6),
  ('BILLS','Rachunki',7),
  ('FIXED','Stałe wydatki',8),
  ('UNPLANNED','Nieplanowane',9),
  ('INVEST','Inwestycje',10),
  ('OTHER','Inne',11)
on conflict (code) do nothing;

-- 7. row level security policies
-- transaction_types policies
-- select only; dictionary is read-only to authenticated; deny anon
create policy transaction_types_select_authenticated on transaction_types for select using (auth.role() = 'authenticated');
create policy transaction_types_select_anon on transaction_types for select using (false);
-- disallow insert/update/delete for all standard roles
create policy transaction_types_insert_authenticated on transaction_types for insert with check (false);
create policy transaction_types_insert_anon on transaction_types for insert with check (false);
create policy transaction_types_update_authenticated on transaction_types for update using (false) with check (false);
create policy transaction_types_update_anon on transaction_types for update using (false) with check (false);
create policy transaction_types_delete_authenticated on transaction_types for delete using (false);
create policy transaction_types_delete_anon on transaction_types for delete using (false);

-- budgets policies
-- allow full crud for authenticated (shared context); deny anon
create policy budgets_select_authenticated on budgets for select using (auth.role() = 'authenticated');
create policy budgets_select_anon on budgets for select using (false);
create policy budgets_insert_authenticated on budgets for insert with check (auth.role() = 'authenticated');
create policy budgets_insert_anon on budgets for insert with check (false);
create policy budgets_update_authenticated on budgets for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy budgets_update_anon on budgets for update using (false) with check (false);
create policy budgets_delete_authenticated on budgets for delete using (auth.role() = 'authenticated');
create policy budgets_delete_anon on budgets for delete using (false);

-- transactions policies
-- allow full crud for authenticated users (shared ledger); deny anon
create policy transactions_select_authenticated on transactions for select using (auth.role() = 'authenticated');
create policy transactions_select_anon on transactions for select using (false);
create policy transactions_insert_authenticated on transactions for insert with check (auth.role() = 'authenticated');
create policy transactions_insert_anon on transactions for insert with check (false);
create policy transactions_update_authenticated on transactions for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy transactions_update_anon on transactions for update using (false) with check (false);
create policy transactions_delete_authenticated on transactions for delete using (auth.role() = 'authenticated');
create policy transactions_delete_anon on transactions for delete using (false);

commit;
