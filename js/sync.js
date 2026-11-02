// Synchronisierung über dasselbe Supabase-Projekt wie die Karteikarten-App.
// Der ganze Stand liegt als eine Zeile (kind „meta“, id „lernplan“) in der Tabelle „items“ –
// dafür ist keine neue Tabelle nötig. Die Karteikarten-App ignoriert diese Zeile.
import { S, merge, snapshot, onSave, TEST_MODE } from './store.js';

const SUPABASE_URL = 'https://pjearscszkvvbxipgrkm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KcXfeuzOgTd4HpSuHsF5EA_QgDJMV8H';
const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const AUTH_KEY = 'lernplan-auth';
const ROW = { kind: 'meta', id: 'lernplan' };

let client = null;
let user = null;
let running = null;
let again = false;
let timer = null;
let remoteChanged = () => {};
const AGENT_KEY = 'lernplan-agent';
let agent = (() => {
  try {
    return JSON.parse(localStorage.getItem(AGENT_KEY));
  } catch {
    return null;
  }
})();
/** Konfiguration und letzter Lauf des Tagesplan-Agenten der Karteikarten-App (oder null) */
export const getAgent = () => (TEST_MODE ? null : agent);
const status = { state: 'signedOut', lastSync: null, error: null };
const listeners = new Set();

export const onStatus = (fn) => listeners.add(fn);
const setStatus = (patch) => {
  Object.assign(status, patch);
  listeners.forEach((fn) => fn(status));
};
export const getStatus = () => ({ ...status, email: user?.email ?? null });

async function getClient() {
  if (client) return client;
  const { createClient } = await import(SUPABASE_LIB);
  client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_KEY } });
  return client;
}

export async function initSync(onRemoteChange) {
  remoteChanged = onRemoteChange;
  if (TEST_MODE) {
    setStatus({ state: 'disabled' });
    return;
  }
  onSave(() => user && schedule(3000));
  window.addEventListener('online', () => user && schedule(500));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && user && schedule(300));
  if (!localStorage.getItem(AUTH_KEY)) return;
  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    user = data.session?.user ?? null;
    setStatus({ state: user ? 'idle' : 'signedOut' });
    if (user) schedule(0);
  } catch {
    setStatus({ state: 'offline', error: 'Keine Verbindung zum Sync-Server' });
  }
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translate(error.message));
  user = data.user;
  setStatus({ state: 'idle', error: null });
  await syncNow();
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut();
  user = null;
  setStatus({ state: 'signedOut', error: null });
}

function translate(msg) {
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort ist falsch.';
  if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if (/rate limit/i.test(msg)) return 'Zu viele Versuche – bitte kurz warten.';
  if (/fetch|network/i.test(msg)) return 'Keine Internetverbindung.';
  return msg;
}

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow().catch(() => {}), ms);
}

export async function syncNow() {
  if (!user) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      const sb = await getClient();
      const { data, error } = await sb.from('items').select('data').eq('kind', ROW.kind).eq('id', ROW.id).maybeSingle();
      if (error) throw error;
      let changed = data?.data ? merge(data.data) : false;
      // Tagesplan-Agent: steht in den Einstellungen der Karteikarten-App (nur lesen)
      const kk = await sb.from('items').select('data').eq('kind', 'meta').eq('id', 'settings').maybeSingle();
      const daily = kk.data?.data?.daily ?? null;
      if (JSON.stringify(daily) !== JSON.stringify(agent)) {
        agent = daily;
        localStorage.setItem(AGENT_KEY, JSON.stringify(daily));
        changed = true;
      }
      const mine = JSON.stringify(snapshot());
      if (!data?.data || mine !== JSON.stringify(data.data)) {
        const { error: e2 } = await sb.from('items').upsert({ ...ROW, user_id: user.id, data: snapshot(), deleted: false, updated_at: Date.now() }, { onConflict: 'user_id,kind,id' });
        if (e2) throw e2;
      }
      setStatus({ state: 'idle', lastSync: Date.now() });
      if (changed) remoteChanged();
    } catch (e) {
      console.error('Synchronisierung fehlgeschlagen', e);
      setStatus({ state: navigator.onLine ? 'error' : 'offline', error: translate(String(e?.message ?? e)) });
    } finally {
      running = null;
      if (again) {
        again = false;
        schedule(1000);
      }
    }
  })();
  return running;
}
