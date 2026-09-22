# Responsive update

All screens now use the available browser width. Mobile/tablet navigation uses a drawer. Login spacing, dashboard cards, forms, chat/PDF panels and modals adapt to narrow screens. Long content scrolls vertically.

## Apply to your existing project

1. Stop Vite with Ctrl+C.
2. Replace your existing `frontend/src` folder with this ZIP's `frontend/src` folder.
3. Keep your existing `.env` files unchanged.
4. Run `npm run dev` inside `frontend` and hard-refresh the browser (Mac: Cmd+Shift+R).

The complete project is included if you prefer a fresh folder. Copy your own `.env` files into that new folder before running it. No SQL/schema changes are needed for this update.

The Google login error means Supabase is not configured. Follow SETUP.md steps 2–6; use Explore preview until accounts are connected. AI features require the backend and Gemini key.
