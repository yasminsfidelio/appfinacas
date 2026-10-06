-- Finanças do Casal — schema completo (rodar uma vez no SQL Editor do Supabase)

-- ---------- Tabelas ----------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  household_id uuid references public.households on delete set null,
  created_at timestamptz not null default now()
);

-- Casa do usuário logado. SECURITY DEFINER para poder ser usada nas policies
-- de profiles sem recursão.
create function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Contas e receitas fixas (repetem todo mês)
create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  scope text not null check (scope in ('shared', 'personal')),
  kind text not null check (kind in ('expense', 'income')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  due_day int not null check (due_day between 1 and 31),
  start_month date not null,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  scope text not null check (scope in ('shared', 'personal')),
  kind text not null check (kind in ('expense', 'income')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  category text not null,
  -- preenchidos quando o lançamento é o pagamento de uma conta fixa
  recurring_id uuid references public.recurring on delete set null,
  ref_month date,
  -- preenchidos em compras parceladas
  installment_group uuid,
  installment_no int,
  installment_total int,
  created_at timestamptz not null default now()
);

create index transactions_household_date on public.transactions (household_id, date);
-- uma conta fixa só pode ser paga uma vez por mês (evita os dois marcarem juntos)
create unique index transactions_recurring_month on public.transactions (recurring_id, ref_month)
  where recurring_id is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  scope text not null check (scope in ('shared', 'personal')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create unique index budgets_shared_category on public.budgets (household_id, category) where scope = 'shared';
create unique index budgets_personal_category on public.budgets (owner_id, category) where scope = 'personal';

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  scope text not null check (scope in ('shared', 'personal')),
  name text not null,
  emoji text not null default '🎯',
  target numeric(12,2) not null check (target > 0),
  deadline date,
  created_at timestamptz not null default now()
);

create table public.goal_deposits (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- Perfil automático no cadastro ----------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Criar / entrar na casa ----------

create function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.my_household() is not null then raise exception 'Você já faz parte de uma casa'; end if;
  insert into public.households (name) values (p_name) returning id into v_id;
  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

create function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.my_household() is not null then raise exception 'Você já faz parte de uma casa'; end if;
  select id into v_id from public.households where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'Código inválido'; end if;
  if (select count(*) from public.profiles where household_id = v_id) >= 2 then
    raise exception 'Esta casa já tem duas pessoas';
  end if;
  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

revoke execute on function public.my_household(), public.create_household(text), public.join_household(text), public.handle_new_user() from public, anon;
grant execute on function public.my_household(), public.create_household(text), public.join_household(text) to authenticated;

-- ---------- Permissões e RLS ----------

revoke all on public.households, public.profiles, public.recurring, public.transactions,
  public.budgets, public.goals, public.goal_deposits from anon, authenticated;

grant select on public.households, public.profiles to authenticated;
grant update (name) on public.households, public.profiles to authenticated;
grant select, insert, update, delete on public.recurring, public.transactions,
  public.budgets, public.goals, public.goal_deposits to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.recurring enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.goal_deposits enable row level security;

create policy households_select on public.households for select to authenticated
  using (id = public.my_household());
create policy households_update on public.households for update to authenticated
  using (id = public.my_household()) with check (id = public.my_household());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or household_id = public.my_household());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Regra central: itens "shared" são dos dois; itens "personal" só o dono enxerga.
create policy recurring_all on public.recurring for all to authenticated
  using (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()))
  with check (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()));

create policy transactions_all on public.transactions for all to authenticated
  using (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()))
  with check (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()));

create policy budgets_all on public.budgets for all to authenticated
  using (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()))
  with check (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()));

create policy goals_all on public.goals for all to authenticated
  using (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()))
  with check (household_id = public.my_household() and (scope = 'shared' or owner_id = auth.uid()));

-- Depósitos herdam a visibilidade da meta (a subconsulta respeita o RLS de goals).
create policy goal_deposits_all on public.goal_deposits for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id))
  with check (exists (select 1 from public.goals g where g.id = goal_id));
