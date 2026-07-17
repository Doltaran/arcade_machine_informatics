create table if not exists ai_helper_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id integer not null,
  question text not null,
  answer text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_ai_helper_questions_user_level
on ai_helper_questions(user_id, level_id);

alter table ai_helper_questions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_helper_questions'
      and policyname = 'Users can read own ai helper questions'
  ) then
    create policy "Users can read own ai helper questions"
    on ai_helper_questions
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_helper_questions'
      and policyname = 'Users can insert own ai helper questions'
  ) then
    create policy "Users can insert own ai helper questions"
    on ai_helper_questions
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;
