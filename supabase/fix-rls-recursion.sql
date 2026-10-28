-- ========================================================================
-- Fix: infinite RLS recursion (Postgres error 54001, "stack depth limit
-- exceeded") between the profiles/cohorts policies and their helper
-- functions.
--
-- is_teacher() queries `profiles`, which re-triggers the `profiles` policy
-- that calls is_teacher() again — forever. Same loop between
-- teaches_cohort() and `cohorts`. Making these two functions
-- SECURITY DEFINER makes them run with the function owner's privileges
-- (which bypasses RLS) when they query inside themselves, breaking the
-- recursion.
--
-- Run this once in the Supabase SQL Editor on your existing project.
-- ========================================================================

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
