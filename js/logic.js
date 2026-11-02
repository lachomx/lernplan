// Auswertungen: Erledigungsgrad eines Tages, Serie, Wochenwerte.
import { getDay, allTasks, START, weekOf } from './plan.js';
import { addDays, weekday } from './dates.js';
import { S } from './store.js';
import { newCardsOn } from './vocab.js';

export const morningVariant = (date) => S.days[date]?.morning ?? S.settings.morning ?? 'bus';

export function isChecked(date, task) {
  if (task.isTest && S.tests[weekOf(date)]?.done) return true;
  return !!S.days[date]?.checked?.[task.id];
}

/** Aufgaben eines Tages mit Haken-Status */
export function dayTasks(date) {
  const day = getDay(date);
  return { day, tasks: allTasks(day, morningVariant(date)).map((t) => ({ ...t, done: isChecked(date, t) })) };
}

/** 'none' | 'min' | 'part' | 'full' | 'off' (außerhalb des Plans) */
export function dayStatus(date) {
  const { day, tasks } = dayTasks(date);
  const ds = S.days[date];
  const required = tasks.filter((t) => !t.optional);
  const done = required.filter((t) => t.done).length;
  if (!day.inPlan && !ds) return 'off';
  if (required.length && done === required.length) return 'full';
  if (ds?.minimal) return 'min';
  if (done > 0 || tasks.some((t) => t.done)) return 'part';
  return 'none';
}
export const learned = (date) => ['min', 'part', 'full'].includes(dayStatus(date));

/** Aktuelle Serie: Tage am Stück mit Lernen. Ist heute noch nichts erledigt, zählt die Serie bis gestern. */
export function streak(today) {
  let d = learned(today) ? today : addDays(today, -1);
  let n = 0;
  while (d >= START && learned(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function streakStats(today) {
  let longest = 0, cur = 0, total = 0;
  for (let d = START; d <= today; d = addDays(d, 1)) {
    if (learned(d)) {
      cur++;
      total++;
      longest = Math.max(longest, cur);
    } else cur = 0;
  }
  return { current: streak(today), longest, total };
}

export const weekMonday = (w) => addDays(START, (w - 1) * 7);
export const weekSunday = (w) => addDays(START, (w - 1) * 7 + 6);

/** Für welchen Wochentest ist dieser Tag zuständig? Sonntag: diese Woche; Mo–Mi: Nachholen der Vorwoche. */
export function testWeekFor(date) {
  const wd = weekday(date);
  const w = weekOf(date);
  if (wd === 6 && w >= 1 && w <= 17) return w;
  if (wd <= 2 && w - 1 >= 1 && w - 1 <= 17) return w - 1;
  return null;
}

/** Vorschläge für die Wochenkennzahlen aus den abgehakten Aufgaben */
export function weekSuggestions(w) {
  let newCards = 0, inputMin = 0, speakMin = 0, daysLearned = 0, daysMissed = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekMonday(w), i);
    for (const g of newCardsOn(d)) newCards += g.to - g.from + 1;
    const { tasks } = dayTasks(d);
    for (const t of tasks) {
      if (!t.done) continue;
      if (t.cat === 'input') inputMin += t.min;
      if (t.cat === 'sprechen') speakMin += t.min;
    }
    if (learned(d)) daysLearned++;
    else daysMissed++;
  }
  return { newCards, inputHours: Math.round((inputMin / 60) * 10) / 10, speakMin, daysLearned, daysMissed };
}
