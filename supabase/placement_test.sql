create table if not exists placement_test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  knowledge_level integer not null check (knowledge_level in (1, 2, 3)),
  total_questions integer not null default 10,
  correct_answers integer,
  ai_summary text,
  topic_breakdown jsonb,
  answers jsonb not null,
  created_at timestamp with time zone default now()
);

alter table user_progress
add column if not exists knowledge_level integer check (knowledge_level in (1, 2, 3));

alter table placement_test_results enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'placement_test_results'
      and policyname = 'Users can read own placement test results'
  ) then
    create policy "Users can read own placement test results"
    on placement_test_results
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'placement_test_results'
      and policyname = 'Users can insert own placement test results'
  ) then
    create policy "Users can insert own placement test results"
    on placement_test_results
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_progress'
      and policyname = 'Users can read own progress'
  ) then
    create policy "Users can read own progress"
    on user_progress
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_progress'
      and policyname = 'Users can update own progress'
  ) then
    create policy "Users can update own progress"
    on user_progress
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_progress'
      and policyname = 'Users can insert own progress'
  ) then
    create policy "Users can insert own progress"
    on user_progress
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;
