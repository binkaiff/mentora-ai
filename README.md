# Mentora AI — Student Personal Assistant

A responsive blue-and-white student workspace built with React, TypeScript, FastAPI, Supabase PostgreSQL and Gemini. Start with **SETUP.md** for Mac setup and free-tier deployment.

## Included

1. Notes / PDF chat: private PDF upload, page-wise extraction, embeddings, vector retrieval, answers with requested page references and summaries.
2. Smart flashcards: Gemini generation, reveal, self-rated review and increasing review intervals.
3. Adaptive study planner: deterministic scheduling, higher weight for weak topics and exams within 14 days, rebuilding unfinished subject sessions while retaining assignment tasks.
4. Learning progress: actual saved practice results, completed study minutes and topic analysis (at least 3 answers before flagging a topic).
5. Step-by-step tutor: short conversation history, hints and guiding questions.
6. English / Tamil / Sinhala: navigation, key dashboard labels and selected AI response language. Secondary form/help copy remains English in this release.
7. Exam practice: generated multiple-choice questions, 10-minute timer, explanations and saved results.
8. Assignment reminders: due/overdue indicators and scheduled **in-app** notifications through Supabase Cron.
9. Subjects and syllabus: editable topics and exam dates.
10. Assignment breakdown: paste an assignment brief or select an uploaded PDF, generate editable task suggestions, approve them and add unfinished tasks to the planner.

## Start without accounts

```bash
cd frontend
npm ci
npm run dev
```

Open the localhost URL and choose **Explore preview**. Preview data stays in this browser. It does not call an AI model or simulate AI answers. Preview is separate from your signed-in workspace and is not imported automatically.

## Structure

- `frontend/`: React + TypeScript + Vite, responsive custom CSS, Lucide icons, TanStack Query, Recharts, react-i18next, Supabase auth client.
- `backend/`: Python FastAPI, Pydantic, pypdf, Google Gen AI SDK, authenticated Supabase REST access.
- `supabase/schema.sql`: PostgreSQL tables, pgvector, row-level security, quotas, private storage policies and reminder function.
- `supabase/reminders.sql`: optional 15-minute Cron schedule for in-app notifications.
- `tests/`: backend tests; database/UI test files describe how to run their additional tools.
- `render.yaml`: Render backend deployment blueprint.
- `SETUP.md`: full account, local-run and deployment instructions.
- `VERIFICATION.md`: tested behavior and remaining live-service checks.

The initial tool list was simplified in implementation: styling uses custom CSS instead of Tailwind/shadcn; forms use native HTML validation instead of React Hook Form/Zod; navigation uses local screen state rather than React Router. Supabase REST preserves the user's JWT and row-level security, so SQLAlchemy/Alembic are not required. The main React/TypeScript/FastAPI/PostgreSQL/Gemini architecture is unchanged.

## Scope and limits

This is a runnable first release for a personal/student pilot, not an audited multi-tenant production service. It has no payment system, OCR, email notifications, background push, admin dashboard or native mobile app. Upload PDF briefs through Notes & PDF chat, then select the PDF in the assignment form. Scanned documents need OCR outside the app.

AI answers are not guaranteed correct; retrieved-page chips show the pages supplied to the model, not verified citations. Practice answers and progress belong to the student and are editable client-side; this is not a secure assessment platform. Timed quizzes are in-memory and reset on page reload. Tutor and PDF chat retain the latest 60 messages per conversation, with the latest 12 sent to Gemini. A failed request can consume the app's daily quota.

Assignment planning uses simple estimated time slots before the deadline, not a calendar optimizer. Assignment task completion is synchronized with its corresponding planner session. Subject planner daily budgets do not include separately added assignment tasks; review total workload. The planner is rule-based, not a trained ML prediction system. Flashcard review uses a simple interval algorithm, not a validated adaptive memory model.

SQL workspace storage is one JSONB document per student with optimistic version checks. A second tab editing stale data must reload before saving. This keeps the pilot small; migrate to dedicated relational tables as collaboration and scale grow.

## Security essentials

- Backend verifies the Supabase access token with `/auth/v1/user` on every protected request.
- Every database/storage request forwards that user's JWT. No Supabase service-role key is needed.
- Gemini API key belongs only on the backend.
- SQL enables owner-only row-level security on student data. Storage is private.
- Set `ALLOWED_EMAILS` on Render for a small invite-only pilot.
- Quotas: 20 AI operations per student and 100 app-wide per database day, stored atomically. One upload can contain multiple embedding requests, so these limits do not equal provider token/request limits.
- Free-tier Gemini content may be used for product improvement; avoid sensitive/confidential data.
- Use Settings > Export my workspace regularly; PDFs need separate backups.

## License

Project source is provided for your use and modification. Dependencies retain their respective licenses. Do not redistribute uploaded learning material without permission.
