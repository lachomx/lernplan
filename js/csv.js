// CSV-Decks lesen und Karten über ihren Text wiedererkennen (gemeinsam für App und Plan-Erzeugung).

/** CSV mit „;“ als Trennzeichen, Anführungszeichen ("" = ") und „#“-Kommentarzeilen */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, lineStart = true, comment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comment) {
      if (c === '\n') { comment = false; lineStart = true; }
      continue;
    }
    if (lineStart && c === '#') { comment = true; continue; }
    lineStart = false;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = []; lineStart = true;
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
/** Schlüssel einer Karte: Text der Vorderseite ohne HTML und ohne Leerraum. Gleich in Lernplan- und Karteikarten-App. */
export function planKey(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => ENT[e.toLowerCase()] ?? (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : m))
    .replace(/\s+/g, '');
}
