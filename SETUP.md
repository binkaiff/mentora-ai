# Mentora AI — Setup guide (Mac + free-tier hosting)

இந்த order-ல் setup செய்யுங்கள்: **Preview → Supabase → Google login → Gemini → Backend → Frontend → Deployment.**

Never paste API secrets into chat, screenshots or GitHub. `.env` files are ignored by Git. Frontend `VITE_` variables become public: put only the Supabase URL, publishable/anon key and backend URL there.

## 1. Install and preview

Install Node.js 22 LTS (or compatible newer LTS), Python 3.12 and Git. Unzip the project, then open its `mentora-ai` folder in VS Code.

In Terminal:

```bash
cd /path/to/mentora-ai/frontend
npm ci
npm run dev
```

Open the localhost URL printed by Vite, usually `http://localhost:5173`. Click **Explore preview**. The dashboard, subject forms, planner, assignment forms and flashcard review work with sample data. AI and PDF upload deliberately require a real account.

## 2. Create Supabase

1. Create a free project at https://supabase.com/dashboard. Choose a nearby region and keep its database password securely.
2. Open the project's **SQL Editor**. Paste `supabase/schema.sql` and run it **once**. If it fails, fix the reported error before continuing. The script creates only Mentora tables/functions/policies and a `mentora-pdfs` bucket; do not delete existing project tables.
3. Find the **Project URL** and **publishable key** (or legacy anon key) in the project Connect/API settings. These are used in frontend and backend. Do not use `service_role` or secret keys.
4. Verify that the `mentora-pdfs` storage bucket is private.
5. For scheduled reminders, enable `pg_cron` under Database > Extensions, then run `supabase/reminders.sql` once. Check `cron.job` and `cron.job_run_details` in SQL Editor.

**SQL choice:** PostgreSQL, not MySQL. `pgvector` stores 768-dimensional normalized embeddings. The supplied schema owns versioning for this pilot; no Alembic migration is required.

## 3. Configure Google sign-in

1. Create/select a project in Google Cloud Console and configure the OAuth consent screen (Google Auth Platform). Add your email as a test user if the application is in testing mode.
2. Create an OAuth client of type **Web application**.
3. In Supabase Authentication > Sign In / Providers > Google, copy the callback URL shown there. Add that EXACT URL to Google's **Authorized redirect URIs**. It is normally `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
4. Put the Google client ID and client secret into the Supabase Google provider configuration and enable it. The Google client secret does not go into frontend code.
5. Supabase Authentication > URL Configuration: set the local site URL to `http://localhost:5173` and add that URL to the allowed redirect list.
6. After deployment, set the Site URL to your public frontend URL and allow both the production URL and local URL.

This version uses Google OAuth only. It does not need a custom SMTP provider. If you later add email/password login, configure SMTP and verify delivery separately.

## 4. Create a Gemini key

1. Open https://aistudio.google.com/ and create an API key for your project.
2. Check https://ai.google.dev/gemini-api/docs/pricing and your AI Studio quotas. Select a text-generation model that supports `generateContent` structured JSON output and an embedding model that supports `embedContent`, `task_type` and output dimensionality 768. Both must be available to your project and eligible for your intended free tier.
3. The example environment lists `gemini-2.5-flash` and `gemini-embedding-001` as editable starter values, **not guaranteed current availability**. If AI Studio lists either as unavailable/deprecated, replace it with a compatible free-tier model. Do not choose an image/audio-only model for text generation.
4. This project does not turn on billing or automatically upgrade a plan. Keep billing disabled if zero spend is mandatory. If free quota is exhausted, AI calls fail until quota returns.
5. When changing the embedding model, delete and re-upload existing PDFs. Query vectors and stored vectors must use the same model and dimensions.

## 5. Run the backend

Open a second Terminal window:

```bash
cd /path/to/mentora-ai/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` in VS Code:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
GEMINI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
GEMINI_MODEL=YOUR_FREE_TIER_TEXT_MODEL
GEMINI_EMBEDDING_MODEL=YOUR_COMPATIBLE_EMBEDDING_MODEL
ALLOWED_ORIGINS=http://localhost:5173
ALLOWED_EMAILS=your-email@example.com
```

`ALLOWED_EMAILS` is optional; a comma-separated list restricts backend access to those testers. Keep it set for a small pilot. This does not prevent other Google users from creating a Supabase auth account; it blocks their backend access.

Start:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/health` — expect `{"status":"ok","version":"1.0.0"}`. API documentation is at `http://localhost:8000/docs`.

## 6. Connect the frontend

In the frontend terminal, stop the dev server with Ctrl+C, then:

```bash
cp .env.example .env
```

Edit `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Restart `npm run dev`, leave preview mode and click **Continue with Google**. A new account starts empty — no fake progress is copied into it.

## 7. First real-use checks

1. Add one subject with topics and an exam date.
2. Add an assignment with tomorrow's deadline.
3. Upload a small selectable-text PDF you may share (5 MB / 50-page maximum; scanned PDFs unsupported).
4. Ask a question whose answer is on a known page. Open View PDF and check the answer/citation.
5. Generate a summary, flashcards and a practice quiz. Review a flashcard and submit the quiz.
6. Change to Tamil/Sinhala, ask the tutor for an explanation, and check language quality.
7. Create a study plan, mark a session complete and check the progress screen.
8. Paste an assignment brief or select an uploaded PDF, generate task suggestions, edit/approve them and add them to the planner.
9. Reload: data should remain. Sign in with a second test account: it must not see the first account's notes or workspace.
10. Run `select public.mentora_create_reminders();` in SQL Editor (as the project owner), then reopen notifications. The bell also computes due/overdue assignments locally. Scheduled notifications appear in-app only.

## 8. Put source on GitHub

Create an empty private GitHub repository. From the project root:

```bash
git init
git add .
git status
```

Confirm `.env`, `.venv`, `node_modules` and `dist` are not staged. Then:

```bash
git commit -m "Initial Mentora AI project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mentora-ai.git
git push -u origin main
```

Do not use an existing repository unless you intend to add these files to it.

## 9. Deploy backend to Render Free

Create a **Web Service** from that GitHub repository:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance | Free |
| Health check | `/health` |

Add the backend environment variables from step 5 in Render's Environment settings. Do not upload `.env`. `render.yaml` is included if you prefer a Blueprint. Copy the deployed URL, such as `https://YOUR_SERVICE.onrender.com`, and open `/health`.

Render's local disk is temporary, so all permanent PDFs live in Supabase. The free backend sleeps after inactivity and may take around a minute to wake. There is no always-running background worker in this architecture.

## 10. Deploy frontend to Cloudflare Pages

Connect the GitHub repository to **Cloudflare Pages** (not a Python Worker):

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output | `dist` |
| Node version | 22 |

Add these build environment variables:

```dotenv
VITE_API_URL=https://YOUR_SERVICE.onrender.com
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Deploy and copy your `https://YOUR_PROJECT.pages.dev` URL. Now:

- Set Render `ALLOWED_ORIGINS=https://YOUR_PROJECT.pages.dev,http://localhost:5173` (exact origins, no trailing slash), then redeploy/restart.
- Update Supabase Site URL and allowed redirect URLs to include your Pages URL.
- Repeat the checks in step 7 from the public frontend.
- Frontend environment changes require a fresh frontend build/deploy.

Use the free `pages.dev` address; a custom domain is optional and usually costs money.

## 11. Changes after deployment

Edit locally, verify, then:

```bash
git add .
git commit -m "Describe your change"
git push
```

With automatic deployment enabled, connected Render and Pages projects rebuild. Database changes are separate SQL migrations; pushing code does not apply SQL. Do not re-run the initial schema blindly because some policies/triggers already exist.

## Troubleshooting

| Symptom | Check |
|---|---|
| Blank login / OAuth redirect error | Google callback URL, test-user list, Supabase provider credentials and redirect allowlist |
| `Failed to fetch` | Backend URL, sleeping Render service, exact `ALLOWED_ORIGINS`, HTTPS |
| Database request failed | Schema executed, RLS policies, correct publishable/anon key, Supabase project not paused |
| Another tab changed workspace | Reload before editing again; changes that failed to save were not stored |
| AI request failed | Text model availability, API key, billing/free quota; no live provider call was tested during artifact creation |
| Embedding failed | Compatible embedding model, 768 dimensions, API quota; re-upload after changing models |
| No selectable text | The PDF is scanned; perform OCR outside Mentora and re-upload |
| No reminders | Enable pg_cron, schedule SQL, inspect job run logs; only in-app reminders are implemented |
| Native PDF viewer blank on mobile | Use the signed URL in a supported PDF viewer or desktop browser; link expires after 10 minutes |

## Free-tier constraints and documentation

These plans can change; check before launch. This project promises no unlimited or permanent free service.

- Render Free: idle sleep, usage limits, ephemeral storage; free Render Postgres expires, so this project uses Supabase instead. https://render.com/docs/free
- Supabase Free: database/storage/egress quotas, possible inactive-project pause, no included automatic backups. https://supabase.com/pricing
- Cloudflare Pages: build and platform limits. https://developers.cloudflare.com/pages/platform/limits/
- Gemini: model-specific free quotas and data terms. https://ai.google.dev/gemini-api/docs/pricing
- Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Cron: https://supabase.com/docs/guides/cron
- Vite deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/

## Responsive update — replacing the earlier version

Stop the frontend (Ctrl+C). Keep your existing `.env` files safe. Replace the old project's `frontend/src` folder with this version's `frontend/src`, then restart `npm run dev` and hard-refresh the browser. Alternatively, extract the updated full project into a new folder, copy your existing backend/frontend `.env` files into their respective folders, and run `npm ci` in `frontend` before starting it.

No database changes are needed for this layout update. Screen content uses the full available width; long pages scroll vertically so text and controls stay usable. Full-screen layout does not mean browser kiosk mode or forcing all content into one unscrollable viewport.

The login error in the screenshot means frontend Supabase environment variables were missing. Layout changes cannot configure your account. Follow steps 2–6 above, then restart Vite. Until then, choose Explore preview.

For local phone layout testing, use `npm run dev -- --host 0.0.0.0` and your Mac's LAN IP on the same Wi-Fi. For Google sign-in, use the configured localhost URL on your Mac or your HTTPS deployment. Arbitrary HTTP LAN IPs are not a substitute for valid OAuth redirect configuration.
