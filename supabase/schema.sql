-- ========================================================================
-- Vocab Drill Platform — schema + row-level security
-- Run this once in the Supabase SQL editor on a fresh project.
-- ========================================================================

-- ---------- cohorts (classes / levels) ----------
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "B1 Tuesday", "B2 Advanced"
  teacher_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- profiles (one row per person, mirrors auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student','teacher')),
  cohort_id uuid references cohorts(id),
  created_at timestamptz default now()
);

-- ---------- units (vocab drill content) ----------
create table units (
  id text primary key,                -- e.g. "unit-1" (human-chosen slug)
  title text not null,
  eyebrow text,
  summary text,
  "order" integer default 0,
  zh_gloss text,
  struct_note text,
  words jsonb not null default '[]',             -- [{pos, word, def, zh, ex}]
  blanks jsonb not null default '[]',            -- [{sentence, answer}]
  structure_pieces jsonb not null default '[]',  -- [string]
  structure_skeleton jsonb not null default '[]',-- [string]
  cohort_id uuid references cohorts(id),         -- null = visible to all cohorts
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- progress (replaces localStorage mastery tracking) ----------
create table progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id text not null references units(id) on delete cascade,
  drill_type text not null check (drill_type in ('recall','blank')),
  item_key text not null,             -- the word (recall) or sentence (blank)
  history jsonb not null default '[]',-- last up to 5 booleans, oldest first
  mastered_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, unit_id, drill_type, item_key)
);

create index progress_user_unit_idx on progress(user_id, unit_id);
create index profiles_cohort_idx on profiles(cohort_id);
create index units_cohort_idx on units(cohort_id);

-- ========================================================================
-- Row-level security
-- ========================================================================

alter table cohorts enable row level security;
alter table profiles enable row level security;
alter table units enable row level security;
alter table progress enable row level security;

-- Helper: is the current user a teacher, and which cohort(s) do they teach?
-- SECURITY DEFINER is required here: these functions query profiles/cohorts,
-- tables that have RLS policies which call these same functions — without
-- SECURITY DEFINER that's infinite recursion (Postgres error 54001, "stack
-- depth limit exceeded"). Running as the function owner bypasses RLS for
-- the query inside the function body, breaking the cycle.
create or replace function is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function teaches_cohort(target_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from cohorts where id = target_cohort and teacher_id = auth.uid()
  );
$$;

-- ---------- cohorts ----------
create policy "teachers manage their own cohorts"
  on cohorts for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "students read their own cohort"
  on cohorts for select
  using (id = (select cohort_id from profiles where id = auth.uid()));

-- ---------- profiles ----------
create policy "a person reads their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "a person updates their own profile"
  on profiles for update
  using (id = auth.uid());

create policy "teachers read profiles in their cohort"
  on profiles for select
  using (is_teacher() and teaches_cohort(cohort_id));

-- Profile rows are created by the provisioning script using the
-- service_role key, which bypasses RLS — no insert policy needed for
-- ordinary users.

-- ---------- units ----------
create policy "everyone signed in reads units"
  on units for select
  using (auth.uid() is not null);

create policy "teachers create units"
  on units for insert
  with check (is_teacher());

create policy "teachers update their own units"
  on units for update
  using (is_teacher() and created_by = auth.uid());

create policy "teachers delete their own units"
  on units for delete
  using (is_teacher() and created_by = auth.uid());

-- ---------- progress ----------
create policy "a student manages their own progress"
  on progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "teachers read progress for their cohort's students"
  on progress for select
  using (
    is_teacher() and user_id in (
      select p.id from profiles p
      where p.cohort_id in (select id from cohorts where teacher_id = auth.uid())
    )
  );
