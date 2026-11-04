# FITZONE — Page Builder Contract (read this fully before writing code)

You are building pages for a React 19 + TypeScript + Tailwind v4 (CSS-first) fitness app. The backend is already working. You write ONLY the page files assigned to you. Do NOT edit any shared file (App.tsx, main.tsx, lib/*, components/*, styles.css) and do NOT add dependencies (no cdecls, no framer-motion, no extra imports beyond listed). No charts lib other than recharts; no icon lib other than lucide-react.

## Project layout
- client/src/lib/api.ts — `api.get/post/put/del`, `fmt`, `ApiError`, `MUSCLE_COLORS`, `muscleColor(m)`
- client/src/lib/auth.tsx — `useAuth()` returning { user, profile, authed, loading, mustOnboard, login, register, logout, refresh, setProfile }
  - user: {id,email,name,email_verified,created_at}; profile: {age,gender,height_cm,weight_kg,target_weight,experience,goal,location,equipment:string[],days_per_week,duration_pref,calorie_target,onboarded} (goal ∈ muscle_building|fat_loss|strength|endurance|general_fitness; location gym|home; experience beginner|intermediate|advanced)
- client/src/components/ui.tsx — shared primitives (see below)
- client/src/components/layout/AppShell.tsx — `AppShell({children})`, `useTheme()` → {theme, setTheme}, `LogoMark`
- Pages live in client/src/pages/. Import via alias `@/...`.

## Shared components (client/src/components/ui.tsx) — use these, don't rebuild
- `cn(...classes)` classnames helper
- `useToast()` — call like `const toast = useToast()`, then `toast('Saved!', 'ok' | 'err' | 'info')`
- `Button({variant:'primary'|'ghost'|'outline'|'danger'|'subtle', size:'sm'|'md'|'lg'|'icon', loading, ...btnProps})`
- `Card({className, ...})` rounded-3xl border card; `SectionTitle({title, sub, action})`
- `Input, Textarea, Select` (styled), `Field({label, hint, error, children})` label wrapper
- `Badge({color:'line'|'lime'|'danger'|'warn'|'ok'})`
- `Modal({open, onClose, title, children, wide?})` + `Confirm({open,onClose,onConfirm,title,body,danger})`
- `Skeleton({className})`, `EmptyState({icon, title, body, action})`
- `ProgressRing({pct, size=108, stroke=9, color?, children})`
- `StatCard({icon, label, value, sub, accent?})`
- `Segmented<T>({value, onChange, options:[{value,label}], size?})`

Conventions: dark premium UI; bg classes: `bg-night/night2, bg-surface, bg-card, border-line, text-ink, text-muted, text-lime, bg-lime`. Rounded-3xl cards, text-sm body, font-display headings. Every page: top-level `<div className="page-in space-y-6">`. Handle loading (Skeletons mirroring layout) + empty + error states. All buttons must work. Use `fmt` helpers for dates/numbers. Inputs for numbers: `type="number"` with `step`.

Constant you may need: `const MEALS = ['breakfast','lunch','dinner','snack']`, muscle groups list:
`['Chest','Back','Legs','Shoulders','Biceps','Triceps','Forearms','Calves','Glutes','Abs','Cardio']`

## API endpoints (all live, JSON; errors throw ApiError with .message)
- GET `/api/dashboard` → { profile, user, stats:{workouts,workouts7,workouts28,streak,volume,avgDur,totalSec,goalRate,level:{xp,level,into,span,pct}}, nutrition:{target,eaten,protein}, weightHistory:[{entry_date,weight_kg}], frequency:[{date:'YYYY-MM-DD',n,v}], muscle:[{m,n}], todayWorkout:{routineId?,name,exercises:[{tr,rs,name,muscle_group}],duration} | {name,muscle_groups,duration} | null, recentAchievements:[{name,icon,description}] }
- GET `/api/analytics?period=7|30|90|180|365` → { totals:{workouts,volume,sets,totalMin,avgMin}, series:[{date,workouts,volume,minutes}], muscleDist:[{m,n}], e1rm:[{name,e1rm}], prs:[{id,name,weight,reps,e1rm,achieved_at}], weights:[{entry_date,weight_kg}], weeklyFreq:[{wk,n}] }
- GET `/api/profile` → { user, profile, stats:{...achievements-stats}, level:{xp,level,into,span,pct} } ; PUT `/api/profile` {name?,password?,age,gender,height_cm,weight_kg,target_weight,experience,goal,location,equipment:string[],days_per_week,duration_pref,calorie_target}
- GET `/api/export` (JSON download blob), DELETE `/api/account`, GET `/api/notifications` {notifications:[{id,title,body,kind,read,created_at}]} , POST `/api/notifications/read-all`
- POST `/api/onboarding` {age,gender,height_cm,weight_kg,target_weight,experience,goal,location,equipment:string[],days_per_week,duration_pref,calorie_target?} → auto-creates an active starter plan
- Exercises: GET `/api/exercises`?q=&group=&equipment=&difficulty= → {count, exercises:[{id,name,muscle_group,secondary_muscles,equipment,difficulty}]} ; GET `/api/exercises/meta` → {muscleGroups, equipment:[...], difficulties, browseGroups} ; GET `/api/exercises/:id` → { exercise:{...instructions}, best:{weight,e1rm}, pr, lastSets:[{reps,weight,set_index,started_at}], similar:[...] }
- Workouts: GET/POST `/api/workouts/routines` (POST {name,notes,exercises:[{exercise_id,target_sets,target_reps,target_weight,rest_seconds}]}) ; PUT/DELETE `/api/workouts/routines/:id` (PUT {name,notes,exercises:[...]}) ; POST `/api/workouts/routines/:id/duplicate` ; GET `/api/workouts/sessions`?limit → {sessions:[{...,name,started_at,completed_at,duration_sec,total_volume,sets:[{reps,weight,exercise_id,type,done}, ...]}]} (fetch exercise names via a single GET /api/exercises once and map by id) ; POST `/api/workouts/sessions` {routine_id?|name} → {id, exercise_ids}; GET `/api/workouts/sessions/:id` → {session:{...}, sets:[{exercise_id,name,set_index,reps,weight,type,done}], records:[...]}; PUT `/api/workouts/sessions/:id/finish` → {session, sets, prs:n, calories, setCount}; POST `/api/workouts/sessions/:id/sets` {exercise_id,set_index,reps,weight,type}; PUT `/api/workouts/sessions/:id/sets/:setId` {reps?,weight?,done?,type?}
- Plans: GET `/api/plans` → {plans:[{id,name,split,active,days:[{day:'Monday',type:'workout'|'rest',name?,muscle_groups?}]}]} ; POST `/api/plans` {name,split,days[],active?} ; POST `/api/plans/:id/activate` ; PUT `/api/plans/:id` {name,days} ; DELETE
- Nutrition: GET `/api/nutrition/day`?date=YYYY-MM-DD → {date, meals:{breakfast:[{id,name,servings,calories,protein,carbs,fat,fiber,serving}...], lunch:[], dinner:[], snack:[]}, totals:{calories,protein,carbs,fat,fiber}, target, water} ; GET `/api/nutrition/foods`?q=&limit= → {foods:[{id,name,serving,calories,protein,carbs,fat,fiber}]} ; POST `/api/nutrition/foods` {name,serving,calories,protein,carbs,fat,fiber}; POST `/api/nutrition/entries` {food_id,meal,servings,date?} ; DELETE `/api/nutrition/entries/:id`; PATCH `/api/nutrition/water` {date?,delta:+/-250} → {ml}; GET `/api/nutrition/history`?days=14 → {days:[{date,calories,protein,carbs,fat}]}
- Progress: GET/POST `/api/progress/measurements` (POST {weight_kg?,body_fat?,chest?,waist?,arm?,thigh?,shoulder?,entry_date?}) DELETE /:id; GET `/api/progress/photos`, POST {dataUrl,label}, DELETE /:id (files served at `/uploads/<file>`); GET `/api/progress/achievements` → { achievements:[{id,code,name,description,icon,goal,earnedAt|null}], stats, muscleDist }
- Coach: GET `/api/coach/messages` → {messages:[{id,role:'user'|'assistant',content,created_at}]} ; POST `/api/coach/messages` {content} → {reply, demoMode}

## Rechart patterns (keep consistent)
- Wrap charts in `<div className="h-56">` (or h-72). `<ResponsiveContainer width="100%" height="100%">`
- Chart defaults: `<CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false}/>`, `<XAxis dataKey date tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false}/>`, Y same, `<Tooltip cursor={{fill:'rgba(128,128,128,0.08)'}} formatter={(v)=>[fmt cell,'']}/>`, Series stroke="var(--accent)" strokeWidth={2.5} fill for Area: `<Area type="monotone" fillOpacity={0.15}>` Bar fill="var(--accent)" radius={[6,6,0,0]}, Pie with `innerRadius`/donut and `Cell fill={muscleColor(m)}`.

## Page assignment
Build clean, complete, realistic, premium-feeling pages. Everything functional:\n- loading skeletons, empty states, toasts, confirmation dialogs, form validation.\nAfter writing each file, mentally typecheck: correct imports (React not required with react-jsx but fine), no unused vars breaking build (tsconfig strict; unused locals are OK for vite build but keep clean).
