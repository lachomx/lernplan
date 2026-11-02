// Karten-Decks und Vokabelplan: welche Karten an welchem Tag neu dazukommen.
// Der Plan steht fest in vokabelplan.json (erzeugt mit tools/vokabelplan.mjs) und gilt genauso
// für den Tagesplan-Agenten in der Karteikarten-App.
import { DECKS } from './plan.js';
import { addDays } from './dates.js';
import { parseCsv } from './csv.js';

const cards = {}; // deckId → [{ front, back }]
const planDate = {}; // deckId → [Datum je Karte (Index wie in der CSV)]
let plan = { days: {} };

export async function loadDecks() {
  const [planRes] = await Promise.all([
    fetch('vokabelplan.json').then((r) => r.json()),
    ...DECKS.map(async (d) => {
      const res = await fetch('decks/' + d.file);
      cards[d.id] = parseCsv(await res.text()).map(([front, back]) => ({ front, back }));
    }),
  ]);
  plan = planRes;
  for (const d of DECKS) planDate[d.id] = [];
  for (const [date, list] of Object.entries(plan.days)) for (const [deck, nr] of list) planDate[deck][nr - 1] = date;
}

export const deckCards = (id) => cards[id] ?? [];
export const deckTotal = (id) => deckCards(id).length;

/** Die neuen Karten eines Tages je Deck: [{ deck, from, to, cards }] (from/to 1-basiert, inklusive) */
export function newCardsOn(date) {
  const list = plan.days[date] ?? [];
  return DECKS.map((deck) => {
    const nrs = list.filter(([d]) => d === deck.id).map(([, nr]) => nr);
    if (!nrs.length) return null;
    return { deck, from: Math.min(...nrs), to: Math.max(...nrs), cards: nrs.map((nr) => deckCards(deck.id)[nr - 1]) };
  }).filter(Boolean);
}

/** Wie viele Karten sind laut Plan vor Beginn dieses Tages schon eingeführt? */
export function introducedBefore(deck, date) {
  return (planDate[deck.id] ?? []).filter((d) => d && d < date).length;
}

/** Eingeführte Karten bis einschließlich dieses Tages, je Deck */
export function introducedThrough(date) {
  const next = addDays(date, 1);
  return DECKS.map((deck) => ({ deck, count: introducedBefore(deck, next), total: deckTotal(deck.id) }));
}

/** Wann ist ein Deck laut Plan durch? (null, wenn schon vor diesem Tag) */
export function finishDate(deck, from) {
  const last = (planDate[deck.id] ?? []).reduce((m, d) => (d > m ? d : m), '');
  return last && last >= from ? last : null;
}

/** Text ohne HTML (für Mehrfachauswahl) */
export function plain(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.textContent.trim();
}
/** Erster fett gedruckter Teil einer Karte */
export function boldPart(html) {
  const m = html.match(/<b>(.*?)<\/b>/);
  return m ? plain(m[1]) : plain(html);
}
