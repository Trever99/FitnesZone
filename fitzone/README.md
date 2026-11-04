# FITZONE

Premium all-in-one fitness platform — workout tracking, planner, nutrition, progress analytics and an AI coach.

## Stack
- **Frontend:** React 19 + TypeScript, Tailwind CSS v4, Recharts, Lucide icons (Vite)
- **Backend:** Node.js (Express 4, ESM)
- **Database:** SQLite (Node built-in `node:sqlite`) — zero-config, file-based (`data/fitzone.db`), auto-seeded
- **Auth:** JWT bearer tokens, bcrypt password hashing

## Quick start

```bash
npm install
npm run dev        # API on :4000 + web on :5173 (single terminal)
```

Open http://localhost:5173

### Production
```bash
npm run build      # builds client to dist (root)
npm start          # serves API + built client on :4000
```

### Demo account (seeded automatically)
- **email:** demo@fitzone.app
- **password:** demo1234
(complete with 9 weeks of workout history, body measurements, nutrition logs, achievements, and a 4-day Upper/Lower plan)

## Configuration
Environment variables (optional):
- `PORT` (default 4000)
- `JWT_SECRET` — set in production
- `OPENAI_API_KEY` — if set, the AI Coach uses the OpenAI API; otherwise it runs in clearly-labelled **Demo Mode** with expert predefined responses.

## Feature map
- **Auth & onboarding** — register, login/logout, email verification (demo), forgot/reset password (demo links), 4-step onboarding that generates a starter training plan
- **Dashboard** — greeting, stats, today's workout, quick actions, weight/activity charts, muscle distribution, achievements
- **Exercise library** — 63 seeded exercises, search + filters, detail pages with instructions, PRs and last performance
- **Workouts** — routine builder (sets/reps/weight/rest), full live workout mode with rest timer, previous performance, live stats, summary with calories + PR celebration
- **Planner** — PPL / Upper-Lower / Bro / Arnold / Full-Body / Custom generators, editable weekly schedule, plan activation
- **Nutrition** — 80+ food database + custom foods, meal diary, water tracking, macro targets, 14-day history
- **Progress** — measurements history + compare, photo gallery, achievement badges
- **AI Coach** — chat with routine/nutrition/overload/analysis abilities, demo mode or OpenAI
- **Analytics** — selectable period (7D→1Y), volume, sets, PRs, consistency, top lifts
- **Profile** — level/XP system, settings, password change, notifications, data export, account deletion

## Reset the database
Delete the `data/` folder and restart the API — everything reseeds.
