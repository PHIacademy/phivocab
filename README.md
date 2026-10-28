# Vocab Drill Platform

Student drill app + teacher dashboard, built on Next.js (Vercel) + Supabase
(Postgres, auth, storage).

## 1. Create the Supabase project

1. supabase.com → New project (pick a region near your students, e.g. Singapore)
2. SQL Editor → paste the contents of `supabase/schema.sql` → Run
3. Settings → API → copy the **Project URL**, **anon public key**, and
   **service_role key** (keep the last one secret)
4. Authentication → Providers → make sure **Email** is enabled, and under
   **Email Templates** confirm the magic-link template is on (default)
5. Authentication → URL Configuration → add your eventual Vercel URL
   (e.g. `https://your-app.vercel.app/**`) to Redirect URLs once you have it

## 1b. Set up custom SMTP with Gmail (do this before provisioning 30 students)

Supabase's built-in email sender is fine for a quick test, but its free-tier
quota is very low (a handful of emails per hour) — provisioning a class of
30 and having everyone request a magic link will trip a
**"email rate limit exceeded"** error. Fixing this means telling Supabase to
send auth emails through your own SMTP provider instead of its shared one.
Gmail works well here and needs no domain of your own — just an existing
Gmail account. Its sending limit is ~500 emails per rolling 24 hours, far
more than 30 students will ever need in a day.

1. **Turn on 2-Step Verification** on the Gmail account you want to send
   from (Google Account → **Security** → **2-Step Verification**) — this is
   required before Google will let you create an App Password.
2. **Create an App Password**: Google Account → **Security** →
   **2-Step Verification** → scroll down to **App passwords** → create one
   (name it something like "Supabase SMTP") → copy the 16-character password
   it shows you (shown once, no spaces needed when you paste it).
3. **Plug it into Supabase**: Supabase dashboard → your project →
   **Project Settings → Authentication** (older dashboards: **Authentication
   → Settings**) → scroll to **SMTP Settings** → toggle **Enable Custom SMTP**
   → fill in:
   - **Sender email**: your Gmail address (e.g. `yourname@gmail.com`)
   - **Sender name**: e.g. `Vocab Drill`
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: your full Gmail address
   - **Password**: the 16-character App Password from step 2 (not your
     regular Gmail password)
   → **Save**.
4. **Test it**: trigger a magic-link sign-in from `/login` with a real email
   — it should arrive from your Gmail address, and the rate-limit error
   should be gone (custom SMTP uses Gmail's much higher limits, not
   Supabase's).

Once this is set up, re-running `scripts/provision.js` for the full roster
and everyone signing in for the first time won't hit the shared rate limit.

## 2. Local setup

```bash
cp .env.example .env.local
# fill in the three Supabase values
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

## 3. Provision your first teacher + roster

Edit `scripts/roster.example.csv` (or make your own) with real names/emails,
then:

```bash
export SUPABASE_URL=https://xxxxxx.supabase.co \
export SUPABASE_SERVICE_ROLE_KEY=eyJh......... \
node scripts/provision.js scripts/roster.example.csv
```

This creates Supabase Auth accounts, cohort rows, and profile rows for
everyone in the CSV. No passwords are set — everyone signs in with a
magic link sent to their email.

To add more students later (new cohort, or more names in an existing one),
just run the script again with an updated CSV — existing people are
skipped, not duplicated.

## 4. Add your first unit

Sign in as the teacher → you'll land on `/dashboard` → "Manage units" →
"New unit" → fill in the vocab/blanks/sentence-build fields → Create.
(This is the manual builder — the photo-upload auto-fill version can be
added later as a fast-follow.)

## 5. Deploy to Vercel

```bash
git init && git add -A && git commit -m "phivocab platform"
gh repo create phivocab --private --source=. --push
```

Then at vercel.com → **Add New Project** → import that repo → it
auto-detects Next.js. Before the first deploy, add these three
**Environment Variables** (Project Settings → Environment Variables):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase Settings → API (secret) |

Deploy. Then go back to Supabase → Authentication → URL Configuration and
add `https://your-app.vercel.app/auth/callback` to the redirect allow-list
(magic links won't complete sign-in without this).

## How it's organized

- `app/login` — magic-link sign-in
- `app/auth/callback` — completes sign-in, routes teachers → `/dashboard`, students → `/drill`
- `app/drill` — student-facing flashcards / recall / fill-in-blank / sentence-build, reading units from Supabase and writing mastery progress to the `progress` table (5-in-a-row tracking, same as before — just server-backed now instead of localStorage)
- `app/dashboard` — teacher roster view with per-student mastery breakdown, split by cohort
- `app/dashboard/units` — list/create/edit/delete units (the "Version A" manual builder)
- `scripts/provision.js` — bulk account creation from a CSV roster
- `supabase/schema.sql` — full schema + row-level security policies

## Adding a cohort later

Cohorts are created automatically by the provisioning script from the CSV's
`cohort` column — just include a new cohort name in a CSV and run the
script again.

## What's not built yet (possible fast-follows)

- Photo-upload auto-fill for new units (Version B) — would reuse the same
  unit builder form as the review/edit step, with an AI call to draft the
  fields from an uploaded exercise photo
- Password-based login as an alternative to magic links
- CSV export of a cohort's progress for offline review
