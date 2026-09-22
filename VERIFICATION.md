# Verification — 21 September 2026

## Completed locally

- Frontend: TypeScript compilation and Vite production build passed.
- Backend: 9 pytest checks passed — health, missing/invalid auth, planner daily budget and weak-topic priority, empty plan, quota rejection before provider calls, malformed assignment rejection, non-PDF rejection and quiz schema validation.
- Database: the complete SQL schema executed in embedded PostgreSQL (PGlite + pgvector) with minimal Supabase auth/storage stubs. Verified cross-account workspace/notes/storage isolation, blocked cross-account writes, optimistic version conflicts, daily AI limits, denied reminder-function access for ordinary users, reminder deduplication and malformed-record isolation.
- Browser: Chromium automation passed preview subject creation, assignment creation, planner generation, flashcard reveal/review, all feature navigation, 390px mobile overflow check and Tamil navigation selection. No browser page errors were recorded.
- Desktop dashboard and mobile layout screenshots were inspected. Preview contains clearly marked sample data.

## Not verified live

No user's Supabase, Google OAuth, Gemini or hosting credentials were available. Therefore the following are implementation-ready but still require account-connected testing using SETUP.md:

- Real Google OAuth redirects and Supabase JWT session refresh.
- Actual Supabase storage upload/signed URLs and pg_cron scheduling.
- Gemini model availability, generation, embedding quotas and multilingual quality.
- PDF chat answer/citation accuracy on real study material.
- Public Render and Cloudflare deployments, cold-start behavior and production CORS.

Embedded PostgreSQL tests do not replace a two-account test on your Supabase project. Browser tests used preview mode; they did not fake a successful live AI answer. This is not a security audit or a load test.

## Run checks yourself

From the project root after installing backend requirements:

```bash
backend/.venv/bin/python -m pytest -q tests/test_backend.py
cd frontend
npm ci
npm run build
```

Optional database and browser checks:

```bash
cd tests
npm install
npm run test:db
npx playwright install chromium
npm run test:ui
```

For UI tests, install frontend dependencies first and keep port 5173 free. The test starts the dev server automatically and tests preview mode; `.env` is not required. The test writes screenshots to `tests/`. Standard Playwright browser installation is required on your machine. In the build environment a compatible packaged Chromium was used because the normal browser download endpoint was unavailable.

## Responsive update checks

Production build passed again. 91 browser checks passed across 320×568, 390×844, 440×956, 768×1024, 1024×768, 1440×900 and 2560×1440. Checked full-width login, all workspace screens and subject/assignment forms for horizontal page overflow; checked subject creation with crypto.randomUUID unavailable (local HTTP fallback). Zero browser page errors. These checks use preview data, not live cloud AI services.
