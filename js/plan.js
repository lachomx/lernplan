// Der Lernplan aus „Koreanisch-Lernplan.pdf“ als Daten.
// getDay(datum) liefert für jeden Tag die Aufgaben (morgens, abends), Hinweise und Meilensteine.
import { addDays, diffDays, weekday, range } from './dates.js';

export const START = '2026-11-02';
export const PLAN_END = '2027-02-28';
export const TRIP_START = '2027-03-01';
export const TRIP_END = '2027-03-31';

// ---------- Decks (Kapitel 6, Stand 02.11.: Schwerpunkt häufige Wörter) ----------
// rates: ab Datum gilt diese Anzahl neuer Karten pro Tag
// spread: das ganze Deck gleichmäßig auf jeden Tag vom Start bis zum Plan-Ende verteilen (auch Feiertage)
export const DECKS = [
  { id: '00', file: '00_Haeufige-Woerter.csv', name: 'Häufige Wörter', dir: 'KO → DE', type: 'vocab', spread: true },
  { id: '01', file: '01_Yonsei-Wortschatz.csv', name: 'Yonsei-Wortschatz', dir: 'KO → DE', type: 'vocab', spread: true },
  { id: '02', file: '02_Grammatik.csv', name: 'Grammatik', dir: 'Muster + Satz', type: 'grammar', rates: [['2026-11-02', 2]] },
  { id: '03', file: '03_Sprechen-Familie.csv', name: 'Sprechen Familie', dir: 'DE → KO', type: 'speak', rates: [['2026-11-02', 4]] },
  { id: '07', file: '07_Grundwortschatz.csv', name: 'Grundwortschatz', dir: 'KO → DE', type: 'vocab', rates: [['2026-11-16', 5]] },
  { id: '04', file: '04_Sprechen-Freunde.csv', name: 'Sprechen Freunde', dir: 'DE → KO', type: 'speak', rates: [['2026-11-16', 3]] },
  { id: '05', file: '05_Klettern.csv', name: 'Klettern', dir: 'KO → DE', type: 'vocab', rates: [['2026-12-07', 3]] },
  { id: '06', file: '06_Psychologie.csv', name: 'Psychologie', dir: 'KO → DE', type: 'vocab', rates: [['2026-12-14', 3]] },
];

/** Feiertage: Abends nur Karten, kein festes Input-Programm (neue Karten gibt es trotzdem) */
export const HOLIDAYS = new Set(['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-31', '2027-01-01']);

// ---------- Meilensteine (Kapitel 3) ----------
export const MILESTONES = [
  { id: 'm1', date: '2026-11-29', words: 1800, items: ['Yonsei-Deck zu rund zwei Dritteln eingeführt, ca. 1.800 Wörter', 'Easy Korean mit koreanischen Untertiteln zu 70 % verstanden', '10 Höflichkeitswendungen frei abrufbar'] },
  { id: 'm2', date: '2026-12-27', words: 2200, items: ['ca. 2.200 Wörter, Grundwortschatz-Deck durch', 'ein Webtoon-Band gelesen', '10 Minuten über deinen Tag ohne Deutsch'] },
  { id: 'm3', date: '2027-01-31', words: 2600, items: ['ca. 2.600 Wörter', 'vertraute Serie mit koreanischen Untertiteln verstanden', 'erstes Videotelefonat mit den Schwiegereltern auf Koreanisch'] },
  { id: 'm4', date: '2027-02-28', words: 3000, items: ['ca. 3.000 Wörter', 'Kletter-Vlog ohne Untertitel zu 75 % verstanden', '20 Minuten Gespräch mit deiner Freundin'] },
];

// ---------- Zielwerte für die Wochenkennzahlen (Kapitel 10) ----------
export function targets(week) {
  const month = week <= 4 ? 'nov' : week <= 9 ? 'dez' : 'janfeb';
  return {
    newCards: week <= 3 ? 250 : 150,
    hitRate: 85,
    inputHours: week <= 4 ? 4 : 6,
    speakMin: { nov: 20, dez: 40, janfeb: 60 }[month],
    quiz: 80,
  };
}

// ---------- Links ----------
const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const L = {
  youtube: 'https://www.youtube.com/',
  easy: yt('Easy Korean Easy Languages'),
  ttmik: yt('Talk To Me In Korean'),
  pororo: yt('뽀롱뽀롱 뽀로로'),
  yumi: 'https://comic.naver.com/search?keyword=' + encodeURIComponent('유미의 세포들'),
  climb: yt('클라이밍 브이로그'),
  psych: yt('닥터프렌즈 심리'),
  reactor: 'https://www.languagereactor.com/',
  reader: 'https://www.google.com/search?q=' + encodeURIComponent('Short Stories in Korean for Beginners Olly Richards'),
};

// ---------- Aufgaben-Bausteine ----------
// cat: karten · input · sprechen · saetze · orga
const K = (min, text = 'Karten', detail = 'Wiederholungen zuerst, dann neue Karten') => ({ cat: 'karten', min, text, detail });
const I = (min, text, link, detail) => ({ cat: 'input', min, text, link, detail });
const S = (min, text, detail) => ({ cat: 'sprechen', min, text, detail });
const Z = (min, text, detail) => ({ cat: 'saetze', min, text, detail });
const O = (min, text, detail) => ({ cat: 'orga', min, text, detail });
const opt = (t) => ({ ...t, optional: true });

const SAETZE = Z(5, 'Sätze sammeln', 'Nur Sätze mit genau einem unbekannten Wort, höchstens 5–8. Format: Satz ; Wort = Bedeutung, Übersetzung');
const SHADOW = S(5, 'Shadowing', '1–2 Minuten eines verstandenen Ausschnitts zeitgleich nachsprechen');
const GESPR = (text = 'Gespräch mit deiner Freundin', detail = 'Feste 10 Minuten, höchstens eine Korrektur am Ende. Thema aus deinem Input der Woche.') => S(10, text, detail);
const IMPORT08 = O(10, 'Gesammelte Sätze importieren', 'Massenimport in Deck „08 Eigene Sätze“, Trennzeichen Semikolon, Umkehren aus');
const WOCHENTEST = { cat: 'test', min: 15, text: 'Wochentest und Tracker', detail: 'Vokabeln, Sätze, Grammatik, Referenzvideo, Kennzahlen', isTest: true };
const EXTENSIV = I(30, 'Extensiv nach Lust', null, 'Entspannt schauen, hören oder lesen. Nichts nachschlagen, Lücken aushalten.');

// ---------- Woche 1–4 Tag für Tag (Kapitel 4) ----------
const WEEKS_1_4 = {
  // Woche 1
  '2026-11-02': [O(15, 'Einrichten: Decks 00–03 importieren und Tagesplan einschalten', 'Karteikarten-App › Einstellungen › Tagesplan: Decks 00–03 auswählen und den Agenten einschalten. Er holt jeden Tag die geplanten Karten ins Deck „Lernen“.'), K(10, 'Erste Karten'), I(10, 'YouTube-Input', L.youtube)],
  '2026-11-03': [K(10), I(25, 'Easy Korean mit Untertiteln (extensiv)', L.easy), S(5, 'Fünf Familien-Sätze laut lesen', 'Aus Deck 03 bzw. Kapitel 9 des Plans')],
  '2026-11-04': [K(10), I(15, 'Talk To Me In Korean', L.ttmik), GESPR('Mit deiner Freundin die Begrüßungssätze üben')],
  '2026-11-05': [K(10), I(25, 'Pororo (extensiv, nur hören und schauen)', L.pororo), S(5, 'Familien-Sätze laut sprechen')],
  '2026-11-06': [K(10), I(30, 'Extensiv nach Lust: YouTube-Input oder Easy Korean', L.youtube)],
  '2026-11-07': [K(15), O(10, 'Language Reactor in Chrome installieren und an einem Video testen', null), opt(I(45, 'Eine Folge mit deiner Freundin'))],
  '2026-11-08': [K(15), O(10, 'Referenzvideo festlegen (Easy Korean, 3 Min.)', 'In dieser App unter „Mehr“ eintragen. Ab jetzt jede Woche dieselben 3 Minuten ohne Untertitel.'), GESPR(), WOCHENTEST],
  // Woche 2
  '2026-11-09': [K(10), I(25, 'Erster intensiver Ausschnitt mit Language Reactor', L.easy, 'Easy Korean, 3 Minuten, Satz für Satz'), Z(5, 'Sätze notieren')],
  '2026-11-10': [K(10), I(25, '유미의 세포들, Kapitel 1 (Webtoon)', L.yumi)],
  '2026-11-11': [K(10), I(20, 'Talk To Me In Korean', L.ttmik), GESPR('Gespräch: „오늘 하루 어땠어?“')],
  '2026-11-12': [K(10), I(25, 'YouTube-Input', L.youtube), S(5, 'Erster Shadowing-Versuch (1 Minute)')],
  '2026-11-13': [K(10), EXTENSIV],
  '2026-11-14': [K(15), opt(I(45, 'Eine Folge mit koreanischen Untertiteln'))],
  '2026-11-15': [K(15), WOCHENTEST, GESPR()],
  // Woche 3
  '2026-11-16': [O(5, 'Decks 07 und 04 importieren und im Tagesplan auswählen'), K(10), I(25, 'Kletter-Vlog intensiv', L.climb), SAETZE],
  '2026-11-17': [K(10), I(25, 'Webtoon: 유미의 세포들', L.yumi), SHADOW],
  '2026-11-18': [K(10), I(20, 'Easy Korean intensiv', L.easy), SAETZE, GESPR('Gespräch übers Klettern')],
  '2026-11-19': [K(10), I(25, 'Graded Reader', L.reader), SHADOW],
  '2026-11-20': [K(10), EXTENSIV],
  '2026-11-21': [O(15, 'Deck 08 „Eigene Sätze“ anlegen und gesammelte Sätze importieren', 'Massenimport, Trennzeichen Semikolon, Umkehren aus'), K(15)],
  '2026-11-22': [K(15), WOCHENTEST, GESPR()],
  // Woche 4
  '2026-11-23': [K(10), I(25, 'Talk To Me In Korean intensiv', L.ttmik), SAETZE],
  '2026-11-24': [K(10), I(25, 'Webtoon: 유미의 세포들', L.yumi), GESPR()],
  '2026-11-25': [K(10), I(25, 'Kletter-Vlog intensiv', L.climb), SHADOW],
  '2026-11-26': [K(10), I(25, 'Graded Reader', L.reader), GESPR()],
  '2026-11-27': [K(10), EXTENSIV],
  '2026-11-28': [IMPORT08, K(15), I(45, 'Erste Folge 응답하라 1988 mit koreanischen Untertiteln ausprobieren')],
  '2026-11-29': [K(15), { ...WOCHENTEST, text: 'Wochen- und Monatstest', detail: 'Zusätzlich: unbekanntes Video und 2 Minuten über deine Woche aufnehmen' }, O(5, 'Dezember-Abschnitt im Plan lesen')],
};

// ---------- Wochenvorlagen Dezember, Januar, Februar (Kapitel 5) ----------
const DEZ = [
  [K(10), I(25, 'Kletter-Vlog intensiv', L.climb), SAETZE],
  [K(10), I(25, 'Webtoon', L.yumi), GESPR()],
  [K(10), I(25, 'Psychologie-Video intensiv', L.psych), SHADOW],
  [K(10), I(25, 'Serie extensiv (koreanische Untertitel)'), GESPR()],
  [K(10), EXTENSIV],
  [IMPORT08, K(15), I(45, 'Eine Folge mit deiner Freundin (koreanische Untertitel)')],
  [K(15), WOCHENTEST, GESPR()],
];
const JAN = [
  [K(10), I(25, 'Buch: 죽고 싶지만 떡볶이는 먹고 싶어', null, 'Zuerst 5 Seiten am Tag'), SAETZE],
  [K(10), I(25, 'Serie extensiv'), GESPR()],
  [K(10), I(25, 'Kletter- oder Psychologie-Video intensiv', L.climb), SHADOW],
  [S(30, 'Koreanisch-Abend beim Essen'), K(10)],
  [K(10), EXTENSIV],
  [IMPORT08, K(15), I(45, 'Eine Folge')],
  [K(15), WOCHENTEST],
];
const ROLLEN = ['Ankunft bei den Eltern', 'Familienessen', 'Restaurant mit Freunden', 'Kletterhalle', 'Apotheke', 'Taxi'];
const FEB = [
  [K(10), null /* Rollenspiel */, I(15, 'Input nach Wahl')],
  [K(10), I(30, 'Input extensiv')],
  [K(10), null /* Rollenspiel */, S(10, 'Shadowing')],
  [S(30, 'Koreanisch-Abend'), K(10)],
  [K(10), EXTENSIV],
  [IMPORT08, I(45, 'Eine Folge oder ein Kletter-Vlog', L.climb)],
  [K(15), WOCHENTEST],
];

// ---------- Morgens (Kapitel 2) ----------
function morning(date, week) {
  if (date >= TRIP_START) return { trip: [K(15, 'Wiederholungen', 'Damit nichts liegen bleibt. Keine neuen Karten.')] };
  const walk = week >= 3
    ? [I(15, 'Podcast oder Hörbuch', L.ttmik, 'Folgen am Vorabend herunterladen'), S(5, 'Selbstgespräch auf Koreanisch', '„오늘은 … 할 거예요“ – laut oder leise')]
    : [I(20, 'Podcast oder Hörbuch', L.ttmik, 'Folgen am Vorabend herunterladen')];
  return {
    bus: [K(15, 'Karten am Handy', 'Wiederholungen zuerst'), I(5, 'Podcast', L.ttmik)],
    walk,
  };
}

// ---------- Tag zusammensetzen ----------
export function weekOf(date) {
  return Math.floor(diffDays(START, date) / 7) + 1;
}

export function phaseOf(date) {
  const w = weekOf(date);
  if (date < START) return { name: 'Vor dem Start', short: 'Vorbereitung' };
  if (date > TRIP_END) return { name: 'Plan abgeschlossen', short: 'Fertig' };
  if (date >= TRIP_START) return { name: 'März · In Korea', short: 'Korea' };
  const names = { 1: 'Start und Reaktivieren', 2: 'Rhythmus finden', 3: 'Neue Wörter, Sentence Mining startet', 4: 'Alles läuft zusammen' };
  if (w <= 4) return { name: `November · ${names[w]}`, short: 'November' };
  if (w <= 9) return { name: 'Dezember · Wortschatz ausbauen', short: 'Dezember' };
  if (w <= 13) return { name: 'Januar · Input übernimmt', short: 'Januar' };
  return { name: 'Februar · Generalprobe für Korea', short: 'Februar' };
}

/** Letzter Sonntag des Monats → Monatstest */
export function isMonthTestDay(date) {
  return weekday(date) === 6 && addDays(date, 7).slice(5, 7) !== date.slice(5, 7) && date >= START && date <= PLAN_END;
}

const withIds = (date, slot, tasks) => tasks.filter(Boolean).map((t, i) => ({ ...t, id: `${date}:${slot}:${i}` }));

export function getDay(date) {
  const week = weekOf(date);
  const wd = weekday(date);
  const day = { date, week, phase: phaseOf(date), wd, morning: null, evening: [], notes: [], holiday: HOLIDAYS.has(date), inPlan: date >= START && date <= TRIP_END };
  if (!day.inPlan) return day;

  if (day.holiday) {
    day.evening = withIds(date, 'e', [K(15, 'Karten', 'Feiertag: neue Karten und Wiederholungen, sonst frei'), opt(I(30, 'Eine Folge mit koreanischen Untertiteln'))]);
    day.notes.push('Feiertag: Karten reichen, alles andere ist freiwillig.');
    return day;
  }

  if (wd < 5 || date >= TRIP_START) {
    const m = morning(date, week);
    day.morning = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, withIds(date, 'm-' + k, v)]));
  }

  let tasks;
  if (date >= TRIP_START) {
    tasks = [Z(10, '5 Sätze notieren, die du heute gehört oder gebraucht hast', 'Nach der Reise importieren'), S(0, 'Bestellungen, Fragen und Smalltalk selbst übernehmen', 'Deine Freundin springt nur ein, wenn du festhängst.')];
    if (wd === 5) tasks.push(opt(S(0, 'Eine Boulderhalle besuchen', 'Auf Naver Map nach „클라이밍“ oder „볼더링“ suchen')));
  } else if (WEEKS_1_4[date]) {
    tasks = WEEKS_1_4[date];
  } else if (week <= 9) {
    tasks = [...DEZ[wd]];
  } else if (week <= 13) {
    tasks = [...JAN[wd]];
  } else {
    const roleIdx = (week - 14) * 2 + (wd === 2 ? 1 : 0);
    tasks = FEB[wd].map((t) => t ?? S(15, `Rollenspiel: ${ROLLEN[roleIdx % ROLLEN.length]}`, 'Mit deiner Freundin, 15 Minuten'));
  }
  tasks = tasks.map((t) => ({ ...t }));

  // Besondere Tage
  const extra = {
    '2026-12-07': [O(5, 'Deck 05 Klettern importieren und im Tagesplan auswählen', '3 neue Karten pro Tag')],
    '2026-12-14': [O(5, 'Deck 06 Psychologie importieren und im Tagesplan auswählen', '3 neue Karten pro Tag')],
    '2027-01-09': [O(10, 'Videotelefonat vorbereiten: 5 Fragen an die Eltern', 'Höflichkeitsformen aus Deck 03 nutzen')],
    '2027-01-10': [S(10, 'Erstes Videotelefonat mit den Eltern auf Koreanisch')],
    '2027-02-06': [O(10, 'Videotelefonat vorbereiten: Fragen und Themen')],
    '2027-02-07': [S(15, 'Videotelefonat mit den Eltern')],
    '2027-02-27': [O(10, 'Videotelefonat vorbereiten')],
    '2027-02-28': [S(15, 'Videotelefonat mit den Eltern'), O(15, 'Abschlusstest: Aufnahmen von November, Dezember und Februar vergleichen')],
  }[date];
  if (extra) tasks.push(...extra);

  // Tagebuch ab 14.12. jeden Abend
  if (date >= '2026-12-14' && date <= PLAN_END) {
    tasks.push(Z(5, 'Tagebuch: 3 Sätze', wd === 6 ? 'Heute korrigiert deine Freundin die Sätze der Woche' : 'Einmal pro Woche korrigiert deine Freundin'));
  }
  // Februar: Sprech-Decks noch einmal komplett laut durchgehen (je Woche ein Samstag)
  if (week >= 14 && week <= 17 && wd === 5) tasks.push(O(15, 'Deck 03 oder 04 komplett laut durchgehen', 'Abwechselnd: Familie und Freunde; Reise- und Arztwortschatz aus Deck 01 auffrischen'));

  if (isMonthTestDay(date)) {
    const t = tasks.find((x) => x.isTest);
    if (t) Object.assign(t, { text: 'Wochen- und Monatstest', detail: 'Zusätzlich: unbekanntes Video und 2 Minuten über deine Woche aufnehmen' });
  }

  day.evening = withIds(date, 'e', tasks);

  // Hinweise
  if (week >= 10 && week <= 13 && date <= PLAN_END) day.notes.push('Januar: Hauptquelle für neue Karten ist Deck 08 mit ca. 8 eigenen Sätzen pro Tag.');
  if (week >= 5 && week <= 9) day.notes.push('Dezember: Serien am Fernseher nur noch mit koreanischen Untertiteln. Intensiv zu extensiv 40 : 60.');
  if (week >= 14 && date <= PLAN_END) day.notes.push('Februar: Wiederholungen und eigene Sätze. Optional 4–6 Tutorstunden als Generalprobe.');
  if (date === '2026-12-23') day.notes.push('Ab morgen Feiertage: abends nur Karten, alles andere freiwillig.');
  return day;
}

export function allTasks(day, morningVariant) {
  const m = day.morning ? day.morning[morningVariant] ?? day.morning.trip ?? Object.values(day.morning)[0] : [];
  return [...(m ?? []), ...day.evening];
}

export const planDays = () => range(START, TRIP_END);
