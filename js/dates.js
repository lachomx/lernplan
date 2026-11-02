// Datumshilfen. Tage sind immer Zeichenketten „JJJJ-MM-TT“ und werden in Europe/Berlin bestimmt.

const fmtBerlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Heute in Berlin – oder das simulierte Datum aus ?datum=JJJJ-MM-TT */
export function today() {
  const sim = new URLSearchParams(location.search).get('datum');
  if (sim && /^\d{4}-\d{2}-\d{2}$/.test(sim)) return sim;
  return fmtBerlin.format(new Date());
}

const toDate = (d) => new Date(d + 'T12:00:00Z');
const fromDate = (dt) => dt.toISOString().slice(0, 10);

export function addDays(d, n) {
  const dt = toDate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromDate(dt);
}
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
/** 0 = Montag … 6 = Sonntag */
export const weekday = (d) => (toDate(d).getUTCDay() + 6) % 7;
export const mondayOf = (d) => addDays(d, -weekday(d));

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const wdShort = (d) => WD[weekday(d)];
export const shortDate = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
export const longDate = (d) => `${WD_LONG[weekday(d)]}, ${Number(d.slice(8, 10))}. ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

export function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
