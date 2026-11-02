// Wochentest (Kapitel 10 des Plans, erweitert): Vokabeln, Sätze DE → KO, Grammatik/Höflichkeit,
// Referenzvideo und Wochenkennzahlen. Ergebnis wird je Woche gespeichert.
import { DECKS, targets, isMonthTestDay } from './plan.js';
import { S, setTest, updateSettings } from './store.js';
import { deckCards, introducedBefore, introducedThrough, boldPart } from './vocab.js';
import { weekMonday, weekSunday, weekSuggestions } from './logic.js';
import { shortDate } from './dates.js';
import { icon, esc, sanitize, rng, shuffle } from './ui.js';

// Höflichkeitsformen aus Kapitel 9
const HON = [
  ['먹다', 'essen', '드시다'], ['자다', 'schlafen', '주무시다'], ['있다', 'da sein', '계시다'], ['말하다', 'sprechen', '말씀하시다'],
  ['아프다', 'krank sein', '편찮으시다'], ['데리고 가다', 'mitnehmen', '모시고 가다'], ['나이', 'Alter', '연세'], ['이름', 'Name', '성함'],
  ['집', 'Haus', '댁'], ['생일', 'Geburtstag', '생신'], ['주다', 'geben (an Ältere)', '드리다'], ['묻다', 'fragen', '여쭈다'], ['만나다', 'treffen', '뵙다'],
];

let session = null;

/** Karten aus Decks eines Typs: Schwerpunkt auf dieser Woche, Rest aus früheren Wochen */
function pick(type, week, n, rand) {
  const mon = weekMonday(week);
  const through = introducedThrough(weekSunday(week));
  const fresh = [], old = [];
  for (const { deck, count } of through) {
    if (deck.type !== type) continue;
    const before = introducedBefore(deck, mon);
    for (let i = 0; i < count; i++) (i >= before ? fresh : old).push({ deck: deck.id, idx: i });
  }
  const a = shuffle(fresh, rand).slice(0, Math.ceil(n / 2));
  const b = shuffle(old, rand).slice(0, n - a.length);
  const rest = shuffle(fresh.filter((x) => !a.includes(x)), rand).slice(0, n - a.length - b.length);
  return shuffle([...a, ...b, ...rest], rand);
}

function buildMc(week, rand) {
  const qs = [];
  const gram = deckCards('02');
  const introduced = introducedThrough(weekSunday(week)).find((x) => x.deck.id === '02')?.count ?? 0;
  for (const idx of shuffle([...Array(introduced).keys()], rand).slice(0, 2)) {
    const c = gram[idx];
    const others = shuffle(gram.filter((_, i) => i !== idx), rand).slice(0, 3).map((x) => boldPart(x.front));
    qs.push({ q: `Welches Muster bedeutet: „${boldPart(c.back)}“?`, answer: boldPart(c.front), options: shuffle([boldPart(c.front), ...others], rand) });
  }
  for (const [plain, de, hon] of shuffle(HON, rand).slice(0, 4 - qs.length)) {
    const others = shuffle(HON.filter((h) => h[2] !== hon), rand).slice(0, 3).map((h) => h[2]);
    qs.push({ q: `Höfliche Form von ${plain} (${de})?`, answer: hon, options: shuffle([hon, ...others], rand) });
  }
  return qs;
}

function start(week) {
  const attempt = (S.tests[week]?.attempts ?? 0) + 1;
  const rand = rng(week * 7919 + attempt * 104729);
  session = {
    week, attempt, step: 'vocab', i: 0, revealed: false,
    vocab: pick('vocab', week, 20, rand).map((x) => ({ ...x, r: null })),
    speak: pick('speak', week, 5, rand).map((x) => ({ ...x, r: null })),
    mc: buildMc(week, rand).map((x) => ({ ...x, chosen: null })),
    month: isMonthTestDay(weekSunday(week)),
    values: {},
  };
}

const STEPS = ['vocab', 'speak', 'mc', 'video', 'metrics'];
const STEP_LABEL = { vocab: 'Vokabeln', speak: 'Sätze', mc: 'Grammatik', video: 'Video', metrics: 'Kennzahlen' };

export function renderTest(app, week, { tabbar }) {
  if (!week || week < 1 || week > 17) {
    location.hash = '#/heute';
    return;
  }
  const saved = S.tests[week];
  if (!session || session.week !== week) {
    if (saved?.done) {
      app.innerHTML = viewResult(week) + tabbar;
      bindResult(app, week);
      return;
    }
    start(week);
  }
  draw(app, tabbar);
}

function header(title) {
  const s = session;
  const idx = STEPS.indexOf(s.step);
  return `
    <header class="day-head">
      <a class="icon-btn" href="#/heute" aria-label="Schließen">${icon.close}</a>
      <div class="day-title"><p class="eyebrow">${s.month ? 'Wochen- und Monatstest' : 'Wochentest'} · Woche ${s.week} · ${shortDate(weekMonday(s.week))}–${shortDate(weekSunday(s.week))}</p><h1>${esc(title)}</h1></div>
    </header>
    <div class="steps">${STEPS.map((st, i) => `<span class="${i < idx ? 'done' : i === idx ? 'active' : ''}">${STEP_LABEL[st]}</span>`).join('')}</div>`;
}

function cardStep(list, title, hint, labels) {
  const s = session;
  if (!list.length) return `${header(title)}<div class="card empty">Für diesen Teil gibt es noch keine eingeführten Karten.<br><button class="btn primary" data-t="next-step">Weiter</button></div>`;
  const item = list[s.i];
  const c = deckCards(item.deck)[item.idx];
  const deck = DECKS.find((d) => d.id === item.deck);
  return `
    ${header(title)}
    <p class="muted small center">${hint} · Karte ${s.i + 1} von ${list.length} · Deck ${deck.id} ${esc(deck.name)}</p>
    <div class="qcard card">
      <div class="q-front">${sanitize(c.front)}</div>
      ${s.revealed ? `<hr><div class="q-back">${sanitize(c.back)}</div>` : ''}
    </div>
    ${s.revealed
      ? `<div class="rate">
          <button class="btn rate-0" data-t="rate" data-r="0">${labels[0]}</button>
          <button class="btn rate-1" data-t="rate" data-r="1">${labels[1]}</button>
          <button class="btn rate-2" data-t="rate" data-r="2">${labels[2]}</button>
        </div>`
      : `<button class="btn primary big" data-t="reveal">Aufdecken</button>`}`;
}

function draw(app, tabbar) {
  const s = session;
  let html = '';
  if (s.step === 'vocab') html = cardStep(s.vocab, 'Vokabeln', 'Überlegen, dann aufdecken und ehrlich bewerten', ['Nicht gewusst', 'Nach Nachdenken', 'Sofort']);
  else if (s.step === 'speak') html = cardStep(s.speak, 'Sätze auf Koreanisch', 'Satz laut sagen, dann aufdecken', ['Nicht geschafft', 'Mit Fehlern', 'Richtig']);
  else if (s.step === 'mc') {
    const q = s.mc[s.i];
    html = `${header('Grammatik und Höflichkeit')}
      <p class="muted small center">Frage ${s.i + 1} von ${s.mc.length}</p>
      <div class="qcard card"><div class="q-front small-q">${esc(q.q)}</div></div>
      <div class="mc">${q.options.map((o) => {
        const cls = q.chosen == null ? '' : o === q.answer ? 'right' : o === q.chosen ? 'wrong' : 'dim';
        return `<button class="btn ghost mc-opt ${cls}" data-t="choose" data-o="${esc(o)}" ${q.chosen != null ? 'disabled' : ''}>${esc(o)}</button>`;
      }).join('')}</div>
      ${q.chosen != null ? '<button class="btn primary big" data-t="mc-next">Weiter</button>' : ''}`;
  } else if (s.step === 'video') {
    const v = s.values;
    const ref = S.settings.refVideo;
    html = `${header('Verstehen')}
      <div class="card form">
        <p><b>Referenzvideo</b>: dieselben 3 Minuten wie jede Woche, ohne Untertitel.</p>
        ${ref ? `<a class="btn ghost" href="${esc(ref)}" target="_blank" rel="noopener">${icon.link} Video öffnen</a>` : `<label>Noch kein Referenzvideo festgelegt – Link hier eintragen<input class="input" id="ref-url" placeholder="YouTube-Link mit Startzeit" /></label>`}
        <label>Wie viel hast du verstanden? <b id="ref-out">${v.refPct ?? 50} %</b>
          <input type="range" min="0" max="100" step="5" id="ref" value="${v.refPct ?? 50}" /></label>
        ${s.month ? `
          <hr>
          <p><b>Monatstest</b>: ein neues, unbekanntes Video (z. B. Easy Korean oder ein Kletter-Vlog), ohne Untertitel.</p>
          <label>Verständnis unbekanntes Video <b id="unk-out">${v.unknownPct ?? 50} %</b>
            <input type="range" min="0" max="100" step="5" id="unk" value="${v.unknownPct ?? 50}" /></label>
          <label class="check-label"><input type="checkbox" id="rec" ${v.recorded ? 'checked' : ''} /> 2 Minuten über meine Woche auf Koreanisch aufgenommen</label>` : ''}
      </div>
      <button class="btn primary big" data-t="video-next">Weiter</button>`;
  } else if (s.step === 'metrics') {
    const sug = weekSuggestions(s.week);
    const v = s.values;
    const tg = targets(s.week);
    const field = (id, label, val, hint, step = 1) => `<label>${label}<input class="input num" type="number" min="0" step="${step}" id="${id}" value="${val ?? ''}" />${hint ? `<small class="muted">${hint}</small>` : ''}</label>`;
    html = `${header('Kennzahlen der Woche')}
      <div class="card form">
        ${field('m-new', 'Neue Karten diese Woche', v.newCards ?? sug.newCards, `laut Plan ${sug.newCards} · Ziel ca. ${tg.newCards}`)}
        ${field('m-hit', 'Trefferquote in der Karteikarten-App (%)', v.hitRate, `Anteil „Gut“ + „Sehr gut“ bei Wiederholungen · Ziel ${tg.hitRate}–90 %`)}
        ${field('m-input', 'Input-Stunden', v.inputHours ?? sug.inputHours, `aus abgehakten Aufgaben · Ziel mind. ${tg.inputHours} h`, 0.5)}
        ${field('m-speak', 'Minuten auf Koreanisch gesprochen', v.speakMin ?? sug.speakMin, `aus abgehakten Aufgaben · Ziel ${tg.speakMin} Min.`)}
        ${field('m-due', 'Gerade fällige Karten (optional)', v.due, 'steht in deiner Karteikarten-App')}
      </div>
      <button class="btn primary big" data-t="finish">Test abschließen</button>`;
  }
  app.innerHTML = `<div class="page">${html}</div>${tabbar}`;
  bind(app, tabbar);
}

function bind(app, tabbar) {
  const s = session;
  const redraw = () => draw(app, tabbar);
  for (const [id, out] of [['ref', 'ref-out'], ['unk', 'unk-out']]) {
    const el = app.querySelector('#' + id);
    if (el) el.addEventListener('input', () => (app.querySelector('#' + out).textContent = el.value + ' %'));
  }
  app.querySelectorAll('[data-t]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.t;
      const list = s.step === 'vocab' ? s.vocab : s.speak;
      if (t === 'reveal') s.revealed = true;
      else if (t === 'rate') {
        list[s.i].r = Number(b.dataset.r);
        s.revealed = false;
        if (++s.i >= list.length) nextStep();
      } else if (t === 'next-step') nextStep();
      else if (t === 'choose') s.mc[s.i].chosen = b.dataset.o;
      else if (t === 'mc-next') {
        if (++s.i >= s.mc.length) nextStep();
      } else if (t === 'video-next') {
        s.values.refPct = Number(app.querySelector('#ref').value);
        const url = app.querySelector('#ref-url')?.value.trim();
        if (url) updateSettings({ refVideo: url });
        if (s.month) {
          s.values.unknownPct = Number(app.querySelector('#unk').value);
          s.values.recorded = app.querySelector('#rec').checked;
        }
        nextStep();
      } else if (t === 'finish') {
        const num = (id) => {
          const v = app.querySelector('#' + id).value;
          return v === '' ? null : Number(v);
        };
        Object.assign(s.values, { newCards: num('m-new'), hitRate: num('m-hit'), inputHours: num('m-input'), speakMin: num('m-speak'), due: num('m-due') });
        finish();
        session = null;
        renderTest(app, s.week, { tabbar });
        window.scrollTo(0, 0);
        return;
      }
      redraw();
      window.scrollTo(0, 0);
    }),
  );
}

function nextStep() {
  session.step = STEPS[STEPS.indexOf(session.step) + 1];
  session.i = 0;
  session.revealed = false;
}

function finish() {
  const s = session;
  const pct = (list, val = 2) => (list.length ? Math.round((list.filter((x) => x.r === val).length / list.length) * 100) : null);
  setTest(s.week, {
    done: true,
    month: s.month,
    attempts: s.attempt,
    date: new Date().toISOString().slice(0, 10),
    quizPct: pct(s.vocab),
    quizKnown: s.vocab.filter((x) => x.r === 2).length,
    quizTotal: s.vocab.length,
    speakPct: pct(s.speak),
    mcCorrect: s.mc.filter((q) => q.chosen === q.answer).length,
    mcTotal: s.mc.length,
    wrong: [...s.vocab, ...s.speak].filter((x) => x.r === 0).map(({ deck, idx }) => ({ deck, idx })),
    shaky: [...s.vocab, ...s.speak].filter((x) => x.r === 1).map(({ deck, idx }) => ({ deck, idx })),
    mcWrong: s.mc.filter((q) => q.chosen !== q.answer).map((q) => ({ q: q.q, answer: q.answer })),
    ...s.values,
  });
}

// ---------- Auswertung ----------
function advice(week) {
  const r = S.tests[week];
  const prev = S.tests[week - 1];
  const tg = targets(week);
  const sug = weekSuggestions(week);
  const out = [];
  if (r.quizPct != null && r.quizPct < 80) out.push('Weniger als 80 % sofort gewusst: Senke die neuen Karten pro Tag um 5 (bei „Neue Vokabeln“ → Stand korrigieren).');
  if (r.hitRate != null && r.hitRate < 80) out.push('Trefferquote unter 80 %: Neue Karten pro Tag um 5 senken.');
  if (r.due != null && r.due > 200) out.push('Mehr als 200 fällige Karten: keine neuen Karten, bis du unter 100 bist. Nichts löschen, nicht nachholen.');
  if (r.refPct != null && r.refPct < 70 && week >= 4) out.push('Unter 70 % verstanden: Wenn sich dein übriges Material genauso schwer anfühlt, geh eine Stufe zurück. Das ist kein Rückschritt, das ist die Methode.');
  if (r.inputHours != null && r.inputHours < tg.inputHours) out.push(`Weniger als ${tg.inputHours} Stunden Input: Extensiver Input zählt auch, z. B. eine Folge am Fernseher mit koreanischen Untertiteln.`);
  if (r.speakMin != null && r.speakMin < tg.speakMin) out.push('Wenig gesprochen: Selbstgespräche beim Laufen und Shadowing zählen. Fester Einstieg: „오늘은 한국어로 10분만 얘기해 볼까?“');
  if (sug.daysMissed >= 2) out.push('Ein paar Tage verpasst: einfach weitermachen und die Wiederholungen über 3–4 Tage verteilen.');
  const done01 = introducedThrough(weekSunday(week)).filter((x) => ['01', '07'].includes(x.deck.id)).every((x) => x.count >= x.total);
  if (done01 && r.quizPct >= 80 && r.refPct >= 70) out.push('Bereit für den Input-Schwerpunkt: Deck 01 und 07 sind eingeführt, Test und Referenzvideo liegen über dem Ziel.');
  if (!out.length) out.push('Alles im grünen Bereich. Weiter so!');
  return { out, prev };
}

const delta = (a, b, unit = '') => (a == null || b == null ? '' : `<small class="${a >= b ? 'up' : 'down'}">${a >= b ? '+' : ''}${Math.round((a - b) * 10) / 10}${unit}</small>`);

function viewResult(week) {
  const r = S.tests[week];
  const { out, prev } = advice(week);
  const tg = targets(week);
  const cardList = (items) => items.map(({ deck, idx }) => {
    const c = deckCards(deck)[idx];
    return c ? `<li><div class="v-front">${sanitize(c.front)}</div><div class="v-back">${sanitize(c.back)}</div></li>` : '';
  }).join('');
  const tile = (label, val, unit, prevVal, target) => `
    <div class="stat card ${val != null && target != null ? (val >= target ? 'ok' : 'low') : ''}">
      <b>${val ?? '–'}${val != null ? unit : ''}</b>${prev ? delta(val, prevVal, unit) : ''}
      <span>${label}${target != null ? ` · Ziel ${target}${unit}` : ''}</span>
    </div>`;
  return `
    <div class="page">
      <header class="day-head">
        <a class="icon-btn" href="#/heute" aria-label="Zurück">${icon.back}</a>
        <div class="day-title"><p class="eyebrow">Woche ${week} · ${shortDate(weekMonday(week))}–${shortDate(weekSunday(week))}</p><h1>Auswertung</h1></div>
      </header>
      <div class="stat-grid">
        ${tile('Vokabeln sofort', r.quizPct, ' %', prev?.quizPct, tg.quiz)}
        ${tile('Sätze richtig', r.speakPct, ' %', prev?.speakPct, null)}
        ${tile('Grammatik', r.mcTotal ? `${r.mcCorrect}/${r.mcTotal}` : null, '', null, null)}
        ${tile('Referenzvideo', r.refPct, ' %', prev?.refPct, null)}
        ${r.unknownPct != null ? tile('Unbekanntes Video', r.unknownPct, ' %', null, null) : ''}
        ${tile('Input', r.inputHours, ' h', prev?.inputHours, tg.inputHours)}
        ${tile('Gesprochen', r.speakMin, ' Min.', prev?.speakMin, tg.speakMin)}
        ${tile('Neue Karten', r.newCards, '', prev?.newCards, null)}
        ${r.hitRate != null ? tile('Trefferquote App', r.hitRate, ' %', prev?.hitRate, tg.hitRate) : ''}
      </div>
      <section>
        <div class="sec-head"><h2>Was du jetzt tust</h2></div>
        <div class="card advice"><ul>${out.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>
      </section>
      ${r.wrong?.length || r.shaky?.length ? `
      <section>
        <div class="sec-head"><h2>Zum Wiederholen</h2><span class="muted">${(r.wrong?.length ?? 0) + (r.shaky?.length ?? 0)} Karten</span></div>
        <div class="card"><ol class="vocab">${cardList([...(r.wrong ?? []), ...(r.shaky ?? [])])}</ol></div>
      </section>` : ''}
      ${r.mcWrong?.length ? `<section><div class="sec-head"><h2>Grammatik nachlesen</h2></div><div class="card"><ul class="plain">${r.mcWrong.map((m) => `<li>${esc(m.q)} → <b>${esc(m.answer)}</b></li>`).join('')}</ul></div></section>` : ''}
      ${r.month || r.unknownPct != null ? `<p class="muted small center">${r.recorded ? 'Aufnahme gemacht. Im Februar vergleichst du alle Aufnahmen.' : 'Denk an die 2-Minuten-Aufnahme über deine Woche.'}</p>` : ''}
      <button class="btn ghost big" data-t="again">Test wiederholen</button>
    </div>`;
}

function bindResult(app, week) {
  app.querySelector('[data-t="again"]')?.addEventListener('click', () => {
    if (!confirm('Test neu machen? Das bisherige Ergebnis dieser Woche wird ersetzt.')) return;
    start(week);
    renderTest(app, week, { tabbar: app.querySelector('.tabbar').outerHTML });
  });
}

export function testResultRows(w) {
  const r = S.tests[w];
  const v = (x, u) => (x == null ? '–' : x + u);
  return `<tr><td><a href="#/test/${w}">${w}</a></td><td>${v(r.quizPct, ' %')}</td><td>${v(r.refPct, ' %')}</td><td>${v(r.inputHours, ' h')}</td><td>${v(r.speakMin, '')}</td></tr>`;
}

