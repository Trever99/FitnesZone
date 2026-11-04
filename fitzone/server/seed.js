import { db, today, dayStart } from './db.js'
import bcrypt from 'bcryptjs'

// name, muscle, secondary, equipment, difficulty, instructions
const EX = [
  ['Barbell Bench Press','Chest','Triceps,Shoulders','Barbell','Intermediate','Lie on a flat bench, grip the bar just outside shoulder width. Lower the bar to your mid-chest with control, then press up until arms lock out. Keep feet planted and shoulder blades retracted.|Primary chest builder. Watch for shoulder flare beyond 90°.'],
  ['Incline Dumbbell Press','Chest','Shoulders,Triceps','Dumbbells','Intermediate','Set bench to 30-45°. Press dumbbells up from chest level, bringing them close at the top. Lower with control to a deep stretch.|Upper chest emphasis.'],
  ['Push-Up','Chest','Triceps,Core','Bodyweight','Beginner','Hands slightly wider than shoulders, body in a straight line. Lower until chest nearly touches the floor, press back up.|Scale: knee push-ups or incline push-ups.'],
  ['Cable Fly','Chest','Shoulders','Cables','Beginner','Set pulleys at chest height. Step forward, slight elbow bend, bring hands together in front of chest in a hugging arc. Squeeze, return slowly.|Pause 1s at peak contraction.'],
  ['Chest Dip','Chest','Triceps','Bodyweight','Advanced','Support yourself on parallel bars, lean torso forward 30°. Bend elbows to lower until chest stretches, press back up.|Impressive bodyweight chest move — use band assist if needed.'],
  ['Machine Chest Press','Chest','Triceps','Machine','Beginner','Sit with back flat against the pad. Grip handles at chest height and press forward until arms extend. Return with control.|Great for beginners and drop sets.'],
  ['Dumbbell Pullover','Chest','Lats','Dumbbells','Intermediate','Lie perpendicular across a bench holding one dumbbell with both hands above your chest. Lower the weight in an arc behind your head, feel the stretch, pull back over.'],
  ['Deadlift','Back','Hamstrings,Glutes','Barbell','Advanced','Stand over the bar with mid-foot. Bend and grip just outside the shins, back flat, chest up. Drive the floor away, keeping the bar against your legs. Lock out hips and knees.|The king of posterior-chain lifts.'],
  ['Pull-Up','Back','Biceps,Core','Bodyweight','Advanced','Hang from a bar with overhand grip slightly wider than shoulders. Pull until your chin clears the bar, lower fully. Use band assisted if needed.'],
  ['Lat Pulldown','Back','Biceps','Machine','Beginner','Sit with thighs locked under the pad. Grip wide, pull the bar to your upper chest while squeezing the shoulder blades down and back.'],
  ['Barbell Row','Back','Biceps,Rear Delts','Barbell','Intermediate','Hinge to ~45°, back flat. Pull the bar toward your lower ribs, keeping elbows close. Lower with control.|Keep torso angle constant throughout.'],
  ['Seated Cable Row','Back','Biceps,Rear Delts','Cables','Beginner','Sit with knees slightly bent. Pull the handle to your stomach, squeeze the shoulder blades, extend arms fully between reps.'],
  ['Dumbbell Single-Arm Row','Back','Biceps','Dumbbells','Beginner','Support one knee and hand on a bench. Keep back flat, row the dumbbell to your hip. Finish the set, then switch arms.'],
  ['Face Pull','Shoulders','Rear Delts,Traps','Cables','Beginner','Set pulley at eye height with rope attachment. Pull toward your face, rotating hands outward so knuckles end beside your ears.'],
  ['Overhead Press','Shoulders','Triceps,Core','Barbell','Intermediate','Stand with the bar at shoulder height. Brace your core and glutes, press the bar overhead in a straight line, moving your head back then under.'],
  ['Dumbbell Lateral Raise','Shoulders','Traps','Dumbbells','Beginner','Hold dumbbells at your sides, slight elbow bend. Raise straight out to shoulder height, leading with the elbows. Lower slowly.'],
  ['Dumbbell Rear Delt Fly','Shoulders','Back','Dumbbells','Beginner','Hinge forward with flat back. Raise dumbbells up and out to the side, squeezing the rear delts. Thumb-down grip optional.'],
  ['Arnold Press','Shoulders','Triceps','Dumbbells','Intermediate','Start with palms facing you at chest level. Press up while rotating palms to face forward at the top. Reverse on the way down.'],
  ['Barbell Shrug','Shoulders','Traps','Barbell','Beginner','Hold the bar at arm’s length. Shrug your shoulders straight up toward your ears, pause a second, lower fully.'],
  ['Barbell Curl','Biceps','Forearms','Barbell','Beginner','Curl the bar toward your chest with elbows pinned at your sides. Lower over 2-3 seconds resisting on the way down.'],
  ['Dumbbell Hammer Curl','Biceps','Forearms','Dumbbells','Beginner','Hold dumbbells with neutral (palms-in) grip. Curl up, keeping the wrist locked and elbow still.'],
  ['Incline Dumbbell Curl','Biceps','Forearms','Dumbbells','Intermediate','Lie back on an incline bench, arms hanging straight down. Curl up, letting the arms stay behind the body for a deep stretch.'],
  ['Preacher Curl','Biceps','Forearms','Machine','Beginner','Rest upper arms on the preacher pad. Curl up and squeeze, lower slowly to full extension.'],
  ['Cable Curl','Biceps','Forearms','Cables','Beginner','Facing the low pulley, curl the bar keeping constant tension through the full range.'],
  ['Triceps Rope Pushdown','Triceps','Forearms','Cables','Beginner','Grip the rope at the high pulley. Push down and split the rope apart at the bottom, elbows locked at your sides.'],
  ['Triceps Bench Dip','Triceps','Chest,Shoulders','Bodyweight','Beginner','Hands on a bench edge behind you, hips close to the bench. Lower by bending the elbows until ~90°, press back up.'],
  ['Overhead Cable Extension','Triceps','Core','Cables','Intermediate','Face away from a low pulley, rope behind head. Extend arms up and forward to full lockout.'],
  ['Close-Grip Bench Press','Triceps','Chest,Shoulders','Barbell','Intermediate','Bench press with hands shoulder-width apart. Lower to the lower chest keeping elbows tucked.'],
  ['Barbell Wrist Curl','Forearms','','Dumbbells','Beginner','Rest forearms on your thighs holding the bar with an underhand grip. Curl the wrists up maximally, lower slowly.'],
  ['Farmer Walk','Forearms','Traps,Core','Dumbbells','Beginner','Carry heavy dumbbells at your sides with tall posture for distance or time. Keep shoulders packed.|Grip and core finisher.'],
  ['Back Squat','Legs','Quadriceps,Glutes','Barbell','Advanced','Bar on upper traps, brace hard and sit down between your heels, knees tracking over toes. Drive up through mid-foot.|Compound king — depth to at least parallel.'],
  ['Front Squat','Legs','Quadriceps,Core','Barbell','Advanced','Bar on the front delts, elbows high. Squat deep maintaining an upright torso.'],
  ['Leg Press','Legs','Glutes,Hamstrings','Machine','Beginner','Feet shoulder-width mid-platform. Lower until knees approach the chest without them caving, press up without locking hard.'],
  ['Hack Squat','Legs','Quadriceps,Glutes','Machine','Intermediate','Back against pad, shoulders under pads. Squat deep; drive evenly through both feet.'],
  ['Leg Extension','Legs','Quadriceps','Machine','Beginner','Sit on the machine, extend legs to straight and squeeze hard at the top, lower slowly with control.'],
  ['Leg Curl','Legs','Hamstrings','Machine','Beginner','Curl the pad toward your glutes, pause at peak, lower slowly resisting through full range.'],
  ['Romanian Deadlift','Legs','Hamstrings,Glutes','Barbell','Intermediate','Soft knees, push hips back while sliding the bar down your thighs. Feel the hamstring stretch, then drive hips forward.'],
  ['Walking Lunge','Legs','Glutes,Hamstrings','Dumbbells','Beginner','Step forward and lower until both knees form 90°. Push through the front heel and step into the next lunge.'],
  ['Bulgarian Split Squat','Legs','Glutes,Quadriceps','Dumbbells','Intermediate','Rear foot elevated on a bench. Lower until the front thigh is parallel to the floor, drive back up. Brutal and effective.'],
  ['Standing Calf Raise','Calves','','Machine','Beginner','Balls of feet on the platform edge. Lower for a deep stretch, then rise fully onto your toes and hold one second.'],
  ['Seated Calf Raise','Calves','','Machine','Beginner','Seated calf raise machine: raise up maximally for 1s, lower slowly for 2s. Keep knees bent throughout.'],
  ['Hip Thrust','Glutes','Hamstrings','Barbell','Intermediate','Upper back on a bench, barbell over the hips. Drive hips to full extension, squeeze glutes one second at the top.'],
  ['Cable Kickback','Glutes','Hamstrings','Cables','Beginner','Ankle strap on a low pulley. Kick one leg straight back and slightly up, squeezing the glute.'],
  ['Glute Bridge','Glutes','Hamstrings','Bodyweight','Beginner','Lie on your back, knees bent. Push through the heels and lift hips into a straight line, squeeze, lower.'],
  ['Plank','Abs','','Bodyweight','Beginner','Hold a straight line from head to heel, elbows under shoulders, brace the abs and squeeze glutes. Breathe steadily.'],
  ['Crunch','Abs','','Bodyweight','Beginner','Knees bent, hands by the ears. Curl the ribcage toward the pelvis (don’t yank the neck), pause and lower.'],
  ['Hanging Leg Raise','Abs','','Bodyweight','Advanced','Hang from a bar, raise straight legs to hip height or higher with a slow, controlled tempo, lower without swinging.'],
  ['Cable Crunch','Abs','','Cables','Intermediate','Kneel below a high pulley, rope behind your head. Crunch your ribs down toward your hips.'],
  ['Dead Bug','Abs','','Bodyweight','Beginner','Lie on your back, opposite arm and leg extended simultaneously. Keep the low back pressed to the floor.'],
  ['Russian Twist','Abs','Obliques','Bodyweight','Beginner','Seated, lean back 45°, rotate your shoulders side to side. Feet down for beginners, up for more challenge.'],
  ['Treadmill Run','Cardio','','Machine','Beginner','Steady pace run on treadmill. Moderate effort allows conversation — 20-40 minutes.'],
  ['Rower','Cardio','','Machine','Beginner','Drive with the legs, then pull with the back and arms; reverse the order on recovery. 20-minute intervals: 1 min hard, 1 min easy.'],
  ['Stationary Bike','Cardio','','Machine','Beginner','Long steady effort or intervals — the safest cardio on the joints.'],
  ['Jump Rope','Cardio','','Bodyweight','Beginner','Light progressions, elbow near ribs. Start 30s on, 15s off for 8 rounds.'],
  ['Burpee','Cardio','','Bodyweight','Advanced','Hands down, kick legs back to a plank, do a push-up, jump feet in, jump up with arms overhead.'],
  ['Mountain Climber','Cardio','Abs','Bodyweight','Beginner','From a plank, alternate driving knees toward the chest fast — keep hips stable.'],
  ['Assault Air Bike','Cardio','','Machine','Advanced','Full-body fan bike. Intervals: 20s sprint, 40s easy × 10. No easing up on the arms.'],
  ['Stair Climber','Cardio','','Machine','Beginner','Long steady climb, avoid leaning on the rails.'],
  ['Box Jump','Cardio','Glutes','Bodyweight','Intermediate','Explode up onto a stable box, land softly with bent knees, step (not jump) back down.'],
  ['EZ-Bar Curl','Biceps','Forearms','Barbell','Beginner','Use the EZ-bar’s angled grip for a shoulder-friendly curl. Control the negative.'],
  ['Cable Lateral Raise','Shoulders','','Cables','Beginner','Single-arm cable lateral raise: perfect peak contraction on the side delts.'],
  ['Chest-Supported Row','Back','','Machine','Intermediate','Row on an incline bench or dedicated machine — removes any torso cheating or lower-back stress.'],
]

// name, serving, kcal, protein, carbs, fat, fiber
const FOODS = [
  ['Chicken Breast, grilled','1 breast (174 g)',284,54,0,6,0],
  ['Chicken Breast, raw','100 g',165,31,0,4,0],
  ['Whole Egg','1 large (50 g)',72,6,0.4,5,0],
  ['Egg White','1 (33 g)',17,4,0.2,0,0],
  ['Oats, dry','100 g',379,13,68,7,10],
  ['Whey Protein','1 scoop (30 g)',120,24,3,1.5,0],
  ['Casein Protein','1 scoop (32 g)',120,25,3,1,0],
  ['Lean Ground Beef, 5%','150 g',216,39,0,6,0],
  ['Salmon, baked','150 g',280,34,0,15,0],
  ['Tuna, canned in water','1 can (140 g)',128,28,0,1,0],
  ['White Rice, cooked','1 cup (185 g)',206,4,45,0.5,0.6],
  ['Brown Rice, cooked','1 cup (195 g)',218,5,46,2,3.5],
  ['Sweet Potato, baked','1 medium (200 g)',180,4,41,0,6.5],
  ['Potato, baked','1 medium (170 g)',160,4,37,0.2,4],
  ['Whole Milk','250 ml',155,8,12,8,0],
  ['Greek Yogurt 0%','1 cup (227 g)',133,23,6,0.8,0],
  ['Greek Yogurt 2%','1 cup (227 g)',170,20,7,5,0],
  ['Cottage Cheese','1 cup (226 g)',163,28,6,2,0],
  ['Banana','1 medium (118 g)',105,1,27,0.4,3],
  ['Apple','1 medium (182 g)',95,0.5,25,0.3,4.4],
  ['Orange','1 medium (140 g)',62,1,15,0.2,3.1],
  ['Blueberries','1 cup (148 g)',84,1,21,0.5,3.6],
  ['Strawberries','1 cup (152 g)',49,1,12,0.5,3],
  ['Mango','1 cup (165 g)',99,1,25,0.6,2.6],
  ['Avocado','1/2 (100 g)',160,2,9,15,7],
  ['Almonds','30 g',173,6,6,15,4],
  ['Walnuts','30 g',196,5,4,20,2],
  ['Peanut Butter','2 tbsp (32 g)',188,8,6,16,2],
  ['Olive Oil','1 tbsp (14 g)',119,0,0,14,0],
  ['Broccoli, steamed','1 cup (156 g)',55,4,11,0.6,5],
  ['Spinach, raw','100 g',23,3,4,0.4,2.2],
  ['Mixed Salad Greens','100 g',20,2,3,0.2,2],
  ['Tomato','1 medium (125 g)',22,1,5,0.2,1.5],
  ['Cucumber','1 cup sliced (120 g)',15,0.7,4,0.1,0.6],
  ['Bell Pepper','1 medium (120 g)',31,1,7,0.3,2.5],
  ['Carrot','1 medium (61 g)',25,0.6,6,0.1,1.8],
  ['Whole Wheat Bread','1 slice (43 g)',92,4,17,1.2,3],
  ['White Bread','1 slice (36 g)',96,3,18,1.2,0.9],
  ['Bagel, plain','1 medium (98 g)',257,10,49,1.7,2],
  ['Pasta, cooked','1 cup (140 g)',196,7,38,1,2],
  ['Spaghetti Bolognese','1 serving (350 g)',520,32,55,18,5],
  ['Quinoa, cooked','1 cup (185 g)',222,8,39,4,5],
  ['Lentils, cooked','1 cup (198 g)',230,18,40,0.8,16],
  ['Chickpeas, cooked','1 cup (164 g)',269,15,45,4,12],
  ['Black Beans','1 cup (172 g)',227,15,41,0.9,15],
  ['Tofu, firm','100 g',144,17,3,9,2],
  ['Tempeh','100 g',192,20,8,11,0],
  ['Salmon Fillet, raw','150 g',309,30,0,20,0],
  ['Cod, baked','150 g',150,28,0,3,0],
  ['Shrimp, cooked','150 g',149,27,2,2,0],
  ['Turkey Breast, deli','100 g',114,22,4,1.5,0],
  ['Bacon','2 slices (20 g)',108,7,0.3,8,0],
  ['Pizza, cheese slice','1 slice (107 g)',285,12,36,10,2.5],
  ['Cheeseburger','1 burger (215 g)',550,30,40,28,3],
  ['French Fries, medium','125 g',427,4,53,22,3],
  ['Nachos, small','150 g',610,17,72,33,5],
  ['Chicken Burrito','1 (330 g)',640,32,72,24,7],
  ['Chicken Caesar Salad','1 serving (300 g)',470,36,12,30,4],
  ['Sushi Salmon Roll','8 pieces (220 g)',350,14,50,8,2],
  ['Pad Thai','1 serving (350 g)',690,24,84,25,5],
  ['Protein Bar','1 bar (60 g)',210,20,23,6,10],
  ['Energy Drink','1 can (250 ml)',110,0,28,0,0],
  ['Black Coffee','1 cup (240 ml)',5,0.3,0,0,0],
  ['Latte, whole milk','1 cup (350 ml)',230,12,18,12,0],
  ['Orange Juice','250 ml',112,1.7,26,0.5,0.5],
  ['Coca-Cola','1 can (330 ml)',139,0,35,0,0],
  ['Diet Coke','1 can (330 ml)',0,0,0,0,0],
  ['Dark Chocolate 70%','30 g',160,2,13,13,3],
  ['Ice Cream, vanilla','1/2 cup (66 g)',137,2.3,16,7.3,0.5],
  ['Chocolate Chip Cookie','1 cookie (28 g)',145,1.6,20,6.4,0.6],
  ['Donut, glazed','1 donut (60 g)',240,4,28,13,1],
  ['Granola','1/2 cup (55 g)',260,7,40,8,5],
  ['Cereal, bran flakes','1 cup (50 g)',171,4.5,40,1,7],
  ['Rice Cake, plain','1 cake (9 g)',35,0.7,7,0.3,0.4],
  ['Pancakes with Syrup','3 pancakes (200 g)',520,8,90,14,3],
  ['Chia Seeds','2 tbsp (30 g)',129,5,12,8,10],
  ['Grapes','1 cup (150 g)',104,1,27,0.2,1.4],
  ['Pear','1 medium (180 g)',101,0.6,27,0.2,5],
  ['Ham, deli','100 g',123,20,3,3,0],
  ['Meatballs','120 g',285,22,9,17,1.5],
  ['Steak, sirloin','170 g',460,50,0,26,0],
  ['Pork Chop, grilled','150 g',255,40,0,10,0],
  ['Lamb Rack','150 g',390,34,0,28,0],
  ['Duck Breast','150 g',340,40,0,20,0],
]

const ACH = [
  ['first_workout','First Workout','Complete your first workout session.','dumbbell',1],
  ['w10','Getting Serious','Complete 10 workouts.','target',10],
  ['w25','Iron Habit','Complete 25 workouts.','medal',25],
  ['w50','Half Century','Complete 50 total workouts.','trophy',50],
  ['streak7','7-Day Streak','Work out 7 days in a row.','flame',7],
  ['vol_100t','100 Ton Club','Lift 100,000 kg of total lifetime volume.','scale',100000],
  ['sets100','Century Sets','Finish 100 working sets.','layers',100],
  ['early_bird','Early Bird','Complete a workout before 8 AM.','sunrise',1],
  ['pr5','PR Machine','Set 5 personal records.','zap',5],
  ['consistent','Consistency Champion','Train 3+ times a week for 4 straight weeks.','calendar',1],
  ['nutrition1','Macro Master','Log food 3 days in a row.','apple',1],
]

export function seedAll() {
  if (db.prepare('SELECT COUNT(*) c FROM exercises').get().c > 0) return

  const insEx = db.prepare('INSERT INTO exercises (name,muscle_group,secondary_muscles,equipment,difficulty,instructions) VALUES (?,?,?,?,?,?)')
  const insFood = db.prepare('INSERT INTO foods (name,serving,calories,protein,carbs,fat,fiber) VALUES (?,?,?,?,?,?,?)')
  const insAch = db.prepare('INSERT INTO achievements (code,name,description,icon,goal) VALUES (?,?,?,?,?)')
  const tx = db.transaction(() => {
    for (const e of EX) insEx.run(...e)
    for (const f of FOODS) insFood.run(...f)
    for (const a of ACH) insAch.run(...a)
  })
  tx()

  seedDemoUser()
  console.log('[seed] exercise library, food database and achievements seeded.')
}

// Demo account so the app looks complete on first launch
function seedDemoUser() {
  if (db.prepare('SELECT id FROM users WHERE email = ?').get('demo@fitzone.app')) return
  const hash = bcrypt.hashSync('demo1234', 10)
  const { lastInsertRowid: uid } = db.prepare(
    'INSERT INTO users (email,password_hash,name,email_verified,created_at) VALUES (?,?,?,1,?)'
  ).run('demo@fitzone.app', hash, 'Demo Athlete', Date.now() - 1000 * 60 * 60 * 24 * 180)

  db.prepare(`INSERT INTO profiles (user_id,age,gender,height_cm,weight_kg,target_weight,experience,goal,location,equipment,days_per_week,duration_pref,calorie_target,onboarded)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(uid, 28, 'male', 180, 78.4, 76, 'intermediate', 'muscle_building', 'gym',
      JSON.stringify(['Dumbbells','Barbells','Cables','Machines','Bodyweight']), 4, 60, 2740)

  // Historic body weight trending down slightly
  const insM = db.prepare('INSERT INTO measurements (user_id,entry_date,weight_kg) VALUES (?,?,?)')
  let w = 80.8
  for (let i = 140; i >= 0; i -= 5) {
    insM.run(uid, new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), Math.round(w * 10) / 10)
    w = Math.max(78, w - (Math.random() * 0.18) - 0.05)
  }

  // 12 weeks of workout history (Mon/Tue/Thu/Fri)
  const exercises = db.prepare('SELECT id FROM exercises').all()
  const pick = () => exercises[Math.floor(Math.random() * exercises.length)].id
  const insS = db.prepare('INSERT INTO sessions (user_id,name,started_at,completed_at,duration_sec,total_volume) VALUES (?,?,?,?,?,?)')
  const insSet = db.prepare('INSERT INTO exercise_sets (session_id,exercise_id,set_index,reps,weight,done) VALUES (?,?,?,?,?,1)')
  const now = Date.now()
  for (let i = 63; i >= 1; i--) {
    const day = new Date(now - i * 86400000)
    if (![1, 2, 4, 5].includes(day.getDay())) continue
    const start = dayStart(day.toISOString().slice(0, 10)).getTime() + (17 * 3600 + Math.floor(Math.random() * 5400)) * 1000
    const dur = 3000 + Math.floor(Math.random() * 1800)
    const names = ['Push Day','Pull Day','Leg Day','Upper Body','Full Body','Chest & Triceps','Back & Biceps']
    const { lastInsertRowid: sid } = insS.run(uid, names[Math.floor(Math.random() * names.length)], start, start + dur * 1000, dur, 0)
    let volume = 0
    const n = 5 + Math.floor(Math.random() * 3)
    for (let j = 0; j < n; j++) {
      const exId = pick()
      const sets = 3 + Math.floor(Math.random() * 2)
      for (let s = 0; s < sets; s++) {
        const reps = 6 + Math.floor(Math.random() * 9)
        const weight = Math.round((20 + Math.random() * 80) / 2.5) * 2.5
        volume += reps * weight
        insSet.run(sid, exId, s, reps, weight)
      }
    }
    db.prepare('UPDATE sessions SET total_volume = ? WHERE id = ?').run(volume, sid)
    db.prepare(`INSERT INTO personal_records (user_id,exercise_id,weight,reps,e1rm,achieved_at) VALUES (?,?,?,?,?,?)`)
      .run(uid, pick(), 90, 5, 90 * (36 / (37 - 5)), start)
  }

  // Today's food log
  const d = today()
  const food = (id) => db.prepare('SELECT * FROM foods WHERE id = ?').get(id)
  const f = food(1); const f2 = food(5); const f3 = food(17); const f4 = food(20); const f5 = food(8)
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)')
    .run(uid, f.id, 'breakfast', 1, d, Date.now() - 3600000 * 8)
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)').run(uid, f2.id, 'breakfast', 0.8, d, Date.now() - 3600000 * 8)
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)').run(uid, f3.id, 'lunch', 1, d, Date.now() - 3600000 * 3)
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)').run(uid, f4.id, 'snack', 1, d, Date.now() - 3600000)
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)').run(uid, f5.id, 'dinner', 1, d, Date.now() - 900000)
  db.prepare('INSERT INTO water_log (user_id,log_date,ml) VALUES (?,?,?)').run(uid, d, 1750)

  // Starter plan + routine
  const { lastInsertRowid: planId } = db.prepare('INSERT INTO plans (user_id,name,split,days,active,created_at) VALUES (?,?,?,?,1,?)')
    .run(uid, 'Upper / Lower 4-Day', 'upper_lower', JSON.stringify([
      { day: 'Monday', type: 'workout', name: 'Upper Power', muscle_groups: 'Chest, Back, Shoulders, Arms' },
      { day: 'Tuesday', type: 'workout', name: 'Lower Power', muscle_groups: 'Quads, Hamstrings, Glutes, Calves' },
      { day: 'Wednesday', type: 'rest' },
      { day: 'Thursday', type: 'workout', name: 'Upper Hypertrophy', muscle_groups: 'Chest, Back, Shoulders, Arms' },
      { day: 'Friday', type: 'workout', name: 'Lower Hypertrophy', muscle_groups: 'Quads, Hamstrings, Glutes, Calves' },
      { day: 'Saturday', type: 'rest' },
      { day: 'Sunday', type: 'rest' },
    ]), Date.now())
  const byName = (n) => db.prepare('SELECT id FROM exercises WHERE name = ?').get(n).id
  for (const [rname, list] of [
    ['Upper Power', [['Barbell Bench Press', 4, '6-8', 70, 120], ['Barbell Row', 4, '6-8', 60, 120], ['Overhead Press', 3, '8-10', 40, 90], ['Lat Pulldown', 3, '10-12', 55, 90], ['Barbell Curl', 3, '10-12', 25, 60], ['Triceps Rope Pushdown', 3, '12-15', 30, 60]]],
    ['Lower Power', [['Back Squat', 4, '5-8', 90, 180], ['Romanian Deadlift', 3, '8-10', 70, 120], ['Leg Press', 3, '10-12', 180, 90], ['Standing Calf Raise', 4, '12-15', 60, 60]]],
    ['Upper Hypertrophy', [['Incline Dumbbell Press', 4, '10-12', 27.5, 90], ['Chest-Supported Row', 4, '10-12', 65, 90], ['Dumbbell Lateral Raise', 4, '12-15', 10, 60], ['Seated Cable Row', 3, '12-15', 55, 75], ['Incline Dumbbell Curl', 3, '12-15', 12, 60], ['Overhead Cable Extension', 3, '12-15', 25, 60]]],
    ['Lower Hypertrophy', [['Hack Squat', 4, '10-12', 140, 120], ['Leg Curl', 4, '12-15', 60, 90], ['Walking Lunge', 3, '12', 24, 90], ['Seated Calf Raise', 4, '15-20', 45, 60]]],
    ['Full Body Express', [['Back Squat', 3, '8-10', 80, 120], ['Barbell Bench Press', 3, '8-10', 60, 90], ['Barbell Row', 3, '8-10', 50, 90], ['Plank', 3, '60 sec', 0, 60]]],
  ]) {
    const { lastInsertRowid: rid } = db.prepare('INSERT INTO routines (user_id,plan_id,name,created_at) VALUES (?,?,?,?)').run(uid, planId, rname, Date.now())
    list.forEach(([name, sets, reps, weight, rest], idx) =>
      db.prepare('INSERT INTO routine_exercises (routine_id,exercise_id,position,target_sets,target_reps,target_weight,rest_seconds) VALUES (?,?,?,?,?,?,?)')
        .run(rid, byName(name), idx, sets, reps, weight, rest))
  }

  const achIns = db.prepare('INSERT INTO user_achievements (user_id,achievement_id,earned_at) VALUES (?,?,?)')
  for (const code of ['first_workout', 'w10', 'w25', 'streak7', 'sets100', 'vol_100t', 'consistent'])
    achIns.run(uid, db.prepare('SELECT id FROM achievements WHERE code = ?').get(code).id, Date.now())

  db.prepare('INSERT INTO notifications (user_id,title,body,kind,created_at) VALUES (?,?,?,?,?)')
    .run(uid, 'Weekly report ready', 'You trained 4 times and lifted 14,320 kg last week. Solid work!', 'success', Date.now() - 7200000)
  db.prepare('INSERT INTO notifications (user_id,title,body,kind,created_at) VALUES (?,?,?,?,?)')
    .run(uid, 'Personal record!', 'New e1RM of 118 kg on Barbell Bench Press.', 'pr', Date.now() - 86400000 * 2)

  console.log('[seed] demo account ready (demo@fitzone.app / demo1234)')
}
