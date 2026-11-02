// Gespeicherter Stand: abgehakte Aufgaben, Deck-Korrekturen, Testergebnisse, Einstellungen.
// Jeder Eintrag trägt einen Zeitstempel t, damit sich die Stände mehrerer Geräte zusammenführen lassen.

const params = new URLSearchParams(location.search);
export const TEST_MODE = params.get('db') === 'test';
const KEY = TEST_MODE ? 'lernplan-test-v1' : 'lernplan-v1';

const empty = () => ({ days: {}, decks: {}, tests: {}, milestones: {}, settings: { t: 0, morning: 'bus', refVideo: '' } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Stand konnte nicht gelesen werden', e);
  }
  return empty();
}

export const S = load();
const listeners = new Set();
export const onSave = (fn) => listeners.add(fn);

export function save({ silent = false } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
  }
  if (!silent) listeners.forEach((fn) => fn());
}

const now = () => Date.now();

export function updateDay(date, fn) {
  const d = S.days[date] ?? { checked: {} };
  fn(d);
  d.t = now();
  S.days[date] = d;
  save();
}
export function updateDeck(id, patch) {
  S.decks[id] = { ...(S.decks[id] ?? {}), ...patch, t: now() };
  save();
}
export function setTest(week, data) {
  S.tests[week] = { ...data, t: now() };
  save();
}
export function setMilestone(id, done) {
  S.milestones[id] = { done, t: now() };
  save();
}
export function updateSettings(patch) {
  Object.assign(S.settings, patch, { t: now() });
  save();
}

/** Fremden Stand einarbeiten; je Eintrag gewinnt der neuere. Gibt zurück, ob sich lokal etwas geändert hat. */
export function merge(remote) {
  let changed = false;
  for (const coll of ['days', 'decks', 'tests', 'milestones']) {
    for (const [k, v] of Object.entries(remote[coll] ?? {})) {
      if (!S[coll][k] || (v.t ?? 0) > (S[coll][k].t ?? 0)) {
        S[coll][k] = v;
        changed = true;
      }
    }
  }
  if (remote.settings && (remote.settings.t ?? 0) > (S.settings.t ?? 0)) {
    S.settings = remote.settings;
    changed = true;
  }
  if (changed) save({ silent: true });
  return changed;
}

/** Nur die Daten (ohne Sync-Verwaltung), für Sync und Export */
export const snapshot = () => ({ days: S.days, decks: S.decks, tests: S.tests, milestones: S.milestones, settings: S.settings });

export function replaceAll(data) {
  const e = empty();
  for (const k of Object.keys(e)) S[k] = data[k] ?? e[k];
  save();
}
