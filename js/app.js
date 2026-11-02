// Koreanisch-Lernplan: Tagesansicht, Kalender, Wochentest, Fortschritt.
import { today, addDays, diffDays, weekday, longDate, shortDate, MONTHS } from './dates.js';
import { START, PLAN_END, TRIP_START, TRIP_END, MILESTONES, weekOf, getDay, isMonthTestDay, targets } from './plan.js';
import { S, updateDay, setMilestone, updateSettings, snapshot, replaceAll, TEST_MODE } from './store.js';
import { loadDecks, newCardsOn, introducedThrough, finishDate, deckTotal } from './vocab.js';
import { dayTasks, dayStatus, streakStats, testWeekFor, morningVariant } from './logic.js';
import { renderTest, testResultRows } from './test.js';
import { lineChart } from './chart.js';
import { icon, esc, sanitize, toast } from './ui.js';
import { initSync, signIn, signOut, syncNow, getStatus, onStatus, getAgent } from './sync.js';

const app = document.getElementById('app');
const CAT = {
  karten: { label: 'Karten', cls: 'cat-karten' },
  input: { label: 'Input', cls: 'cat-input' },
  sprechen: { label: 'Sprechen', cls: 'cat-sprechen' },
  saetze: { label: 'Sätze', cls: 'cat-saetze' },
  orga: { label: 'Wichtig', cls: 'cat-orga' },
  test: { label: 'Test', cls: 'cat-test' },
};

// ---------- Router ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: name || 'heute', arg };
}
let calMonth = null; // 'JJJJ-MM'

function render() {
  const r = route();
  const t = today();
  let html;
  if (r.name === 'tag' && /^\d{4}-\d{2}-\d{2}$/.test(r.arg)) html = viewDay(r.arg, r.arg === t);
  else if (r.name === 'kalender') html = viewCalendar(t);
  else if (r.name === 'test') return renderTest(app, Number(r.arg), { tabbar: tabbar('') });
  else if (r.name === 'fortschritt') html = viewProgress(t);
  else if (r.name === 'mehr') html = viewMore();
  else html = viewDay(t, true);
  app.innerHTML = html + tabbar(r.name === 'tag' && r.arg !== t ? 'kalender' : r.name);
}

function tabbar(active) {
  const tab = (name, label, ic) => `<a href="#/${name}" class="${active === name || (name === 'heute' && !active) ? 'active' : ''}">${ic}<span>${label}</span></a>`;
  return `<nav class="tabbar">${tab('heute', 'Heute', icon.today)}${tab('kalender', 'Kalender', icon.calendar)}${tab('fortschritt', 'Fortschritt', icon.chart)}${tab('mehr', 'Mehr', icon.more)}</nav>`;
}

// ---------- Tagesansicht ----------
function viewDay(date, isToday) {
  const { day, tasks } = dayTasks(date);
  const ds = S.days[date] ?? {};
  const t = today();
  const required = tasks.filter((x) => !x.optional);
  const doneMin = required.filter((x) => x.done).reduce((s, x) => s + x.min, 0);
  const totalMin = required.reduce((s, x) => s + x.min, 0);
  const pct = totalMin ? Math.round((doneMin / totalMin) * 100) : 0;
  const stats = streakStats(t);
  const toKorea = diffDays(t, TRIP_START);
  const nextMs = MILESTONES.find((m) => m.date >= date);

  let head = `
    <header class="day-head">
      ${isToday ? '' : `<a class="icon-btn" href="#/kalender" aria-label="Zurück">${icon.back}</a>`}
      <div class="day-title">
        <p class="eyebrow">${isToday ? 'Heute' : esc(day.inPlan ? `Woche ${day.week}` : '')}</p>
        <h1>${esc(longDate(date))}</h1>
      </div>
      <div class="streak ${stats.current ? 'on' : ''}" title="Tage am Stück">${icon.flame}<b>${stats.current}</b></div>
    </header>`;

  if (date < START) {
    return `<div class="page">${head}<div class="card empty">Dein Plan startet am ${longDate(START)}.</div></div>`;
  }
  if (date > TRIP_END) {
    return `<div class="page">${head}<div class="card empty"><p><b>Plan abgeschlossen.</b></p><p>Mach einen neuen Einstufungstest und erstelle den Plan für April bis Juni.</p></div></div>`;
  }

  const chips = [
    `<span class="chip">${day.week <= 17 ? `Woche ${day.week} von 17` : 'Korea'}</span>`,
    toKorea > 0 ? `<span class="chip">${icon.plane}noch ${toKorea} Tage bis Korea</span>` : '',
    nextMs && date <= PLAN_END ? `<span class="chip">${icon.trophy}Meilenstein in ${diffDays(date, nextMs.date)} Tagen</span>` : '',
  ].join('');

  // Wochentest-Hinweis
  let testBanner = '';
  const tw = testWeekFor(date);
  if (tw && !S.tests[tw]?.done && date <= addDays(PLAN_END, 3)) {
    const month = isMonthTestDay(addDays(START, (tw - 1) * 7 + 6));
    testBanner = `<a class="banner test" href="#/test/${tw}">${icon.trophy}<div><b>${month ? 'Wochen- und Monatstest' : 'Wochentest'} · Woche ${tw}</b><span>ca. 15 Minuten${weekday(date) !== 6 ? ' · noch bis Mittwoch nachholbar' : ''}</span></div>${icon.chevRight}</a>`;
  } else if (tw && S.tests[tw]?.done && weekday(date) === 6) {
    testBanner = `<a class="banner done" href="#/test/${tw}">${icon.check}<div><b>Wochentest erledigt</b><span>Ergebnis ansehen</span></div>${icon.chevRight}</a>`;
  }

  const morningHtml = day.morning ? sectionMorning(date, day) : '';
  const eveningLabel = date >= TRIP_START ? 'In Korea' : weekday(date) >= 5 ? 'Wochenende' : 'Abends';
  const eveningHtml = `
    <section>
      <div class="sec-head">${icon.moon}<h2>${eveningLabel}</h2><span class="muted">${minutes(day.evening.filter((x) => !x.optional))}</span></div>
      <div class="tasks">${tasks.filter((x) => x.id.includes(':e:')).map((x) => taskRow(date, x)).join('')}</div>
    </section>`;

  const notes = day.notes.length ? `<div class="notes">${day.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : '';
  const ms = MILESTONES.find((m) => m.date === date);
  const msHtml = ms ? `<div class="card milestone">${icon.trophy}<div><b>Meilenstein heute</b><ul>${ms.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul><a href="#/fortschritt">Abhaken unter Fortschritt</a></div></div>` : '';

  return `
    <div class="page">
      ${head}
      <p class="phase">${esc(day.phase.name)}</p>
      <div class="chips">${chips}</div>
      <div class="progress-card card">
        <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        <div>
          <b>${doneMin} von ${totalMin} Min.</b>
          <p class="muted small">${required.filter((x) => x.done).length} von ${required.length} Aufgaben erledigt${ds.minimal ? ' · Mindestversion' : ''}</p>
        </div>
      </div>
      ${testBanner}
      ${msHtml}
      ${notes}
      ${morningHtml}
      ${eveningHtml}
      ${sectionVocab(date)}
      <div class="minimal ${ds.minimal ? 'on' : ''}">
        <button class="btn ${ds.minimal ? 'primary' : 'ghost'}" data-action="minimal" data-date="${date}">${ds.minimal ? icon.check + ' Mindestversion gewählt' : 'Schlechter Tag? Mindestversion'}</button>
        <p class="muted small">10 Minuten nur Wiederholungen. Zählt für deine Serie. Neue Karten, die du liegen lässt, kommen morgen wieder dran.</p>
      </div>
    </div>`;
}

const minutes = (tasks) => {
  const m = tasks.reduce((s, t) => s + t.min, 0);
  return m ? `${m} Min.` : '';
};

function sectionMorning(date, day) {
  const variant = morningVariant(date);
  const keys = Object.keys(day.morning);
  const { tasks } = dayTasks(date);
  const list = tasks.filter((t) => t.id.includes(':m-'));
  const switcher = keys.length > 1
    ? `<div class="seg">${keys.map((k) => `<button class="${k === variant ? 'active' : ''}" data-action="variant" data-date="${date}" data-v="${k}">${k === 'bus' ? icon.bus + 'Bus' : icon.walk + 'Laufen'}</button>`).join('')}</div>`
    : '';
  return `
    <section>
      <div class="sec-head">${icon.sun}<h2>Morgens</h2><span class="muted">${minutes(list)}</span>${switcher}</div>
      <div class="tasks">${list.map((t) => taskRow(date, t)).join('')}</div>
    </section>`;
}

function taskRow(date, t) {
  const c = CAT[t.cat] ?? CAT.orga;
  const meta = [t.min ? `${t.min} Min.` : '', c.label, t.optional ? 'optional' : ''].filter(Boolean).join(' · ');
  const right = t.isTest
    ? `<a class="mini-btn" href="#/test/${weekOf(date)}">Start</a>`
    : t.link
      ? `<a class="icon-btn small" href="${esc(t.link)}" target="_blank" rel="noopener" aria-label="Öffnen">${icon.link}</a>`
      : '';
  return `
    <div class="task ${t.done ? 'done' : ''} ${c.cls}">
      <button class="check" data-action="toggle" data-date="${date}" data-id="${t.id}" aria-label="Erledigt">${icon.check}</button>
      <div class="task-main" data-action="toggle" data-date="${date}" data-id="${t.id}">
        <span class="task-text">${esc(t.text)}</span>
        <span class="task-meta"><i class="dot"></i>${esc(meta)}</span>
        ${t.detail ? `<span class="task-detail">${esc(t.detail)}</span>` : ''}
      </div>
      ${right}
    </div>`;
}

function sectionVocab(date) {
  const groups = newCardsOn(date);
  const total = groups.reduce((s, g) => s + g.cards.length, 0);
  let body;
  if (!groups.length) {
    body = `<p class="muted small">${getDay(date).holiday ? 'Feiertag: heute keine neuen Karten.' : date >= TRIP_START ? 'In Korea keine neuen Karten, nur Wiederholungen.' : 'Laut Vokabelplan heute keine neuen Karten aus den vorgefertigten Decks.'}</p>`;
  } else {
    body = groups.map((g) => `
      <details class="deck">
        <summary>
          <span class="deck-id">${g.deck.id}</span>
          <span class="deck-name"><b>${esc(g.deck.name)}</b><small>Karten ${g.from}–${g.to} von ${deckTotal(g.deck.id)} · ${esc(g.deck.dir)}</small></span>
          <span class="deck-count">${g.cards.length}</span>
        </summary>
        <ol class="vocab" start="${g.from}">
          ${g.cards.map((c) => `<li><div class="v-front">${sanitize(c.front)}</div><div class="v-back">${sanitize(c.back)}</div></li>`).join('')}
        </ol>
      </details>`).join('');
  }
  const deck08 = date >= '2026-11-21' && date <= PLAN_END ? `<p class="muted small">Dazu Deck 08 „Eigene Sätze“: ${date >= '2027-01-04' ? 'ca. 8' : '5–8'} pro Tag.</p>` : '';
  return `
    <section>
      <div class="sec-head">${icon.today}<h2>Neue Vokabeln</h2><span class="muted">${total ? total + ' Karten' : ''}</span></div>
      ${agentStatus(date, total)}
      <div class="card vocab-card">
        ${body}
        ${deck08}
      </div>
    </section>`;
}

/** Was der Tagesplan-Agent in der Karteikarten-App heute bereitgestellt hat (über die Synchronisierung) */
function agentStatus(date, planned) {
  const a = getAgent();
  if (!a) {
    if (date !== today() || TEST_MODE) return '';
    if (getStatus().email) return `<p class="agent-note muted small">Der Tagesplan-Agent ist in der Karteikarten-App noch nicht eingerichtet (Einstellungen › Tagesplan).</p>`;
    return `<p class="agent-note muted small">Melde dich unter „Mehr“ an, dann siehst du hier, ob der Tagesplan-Agent die Karten in der Karteikarten-App bereitgestellt hat.</p>`;
  }
  const r = a.lastResult;
  if (!a.enabled) return `<p class="agent-note muted small">Der Tagesplan-Agent ist in der Karteikarten-App ausgeschaltet (Einstellungen › Tagesplan).</p>`;
  if (r?.day === date) {
    const extra = [r.backlog ? `${r.backlog} noch im Rückstand` : '', r.unmatched ? `${r.unmatched} Karten nicht gefunden` : ''].filter(Boolean).join(' · ');
    return `<div class="agent-note ok">${icon.check}<div><b>${r.added} Karten liegen im Deck „Lernen“</b><span>Karteikarten-App · ${r.fromPlan ?? r.added} laut Plan${r.catchUp ? `, ${r.catchUp} nachgeholt` : ''}${extra ? ' · ' + extra : ''}</span></div></div>`;
  }
  if (date === today()) return `<p class="agent-note muted small">Noch nicht bereitgestellt: Der Agent legt ${planned ? `die ${planned} Karten` : 'die Karten'} beim ersten Öffnen der Karteikarten-App ins Deck „Lernen“.</p>`;
  return '';
}

// ---------- Kalender ----------
function viewCalendar(t) {
  if (!calMonth) calMonth = (t < START ? START : t > TRIP_END ? TRIP_END : t).slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const first = `${calMonth}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = weekday(first);
  const stats = streakStats(t);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank"></span>');
  for (let i = 1; i <= daysInMonth; i++) {
    const d = `${calMonth}-${String(i).padStart(2, '0')}`;
    const st = d > t ? 'future' : dayStatus(d);
    const day = getDay(d);
    const marks = [];
    if (day.evening.some((x) => x.cat === 'sprechen' && x.min >= 10)) marks.push('<i class="mk sprechen"></i>');
    if (day.evening.some((x) => x.isTest)) marks.push('<i class="mk test"></i>');
    if (MILESTONES.some((x) => x.date === d)) marks.push('<i class="mk ms"></i>');
    cells.push(`<a class="cal-cell st-${st} ${d === t ? 'today' : ''} ${day.inPlan ? '' : 'outside'}" href="#/tag/${d}"><span>${i}</span><span class="mks">${marks.join('')}</span></a>`);
  }
  const prev = addDays(first, -1).slice(0, 7);
  const next = addDays(`${calMonth}-${daysInMonth}`, 1).slice(0, 7);
  return `
    <div class="page">
      <header class="page-head"><h1>Kalender</h1></header>
      <div class="stat-row">
        <div class="stat card"><b class="orange">${icon.flame}${stats.current}</b><span>Serie</span></div>
        <div class="stat card"><b>${stats.longest}</b><span>Längste Serie</span></div>
        <div class="stat card"><b>${stats.total}</b><span>Lerntage</span></div>
      </div>
      <div class="card cal">
        <div class="cal-nav">
          <button class="icon-btn" data-action="month" data-m="${prev}" aria-label="Vorheriger Monat">${icon.chevLeft}</button>
          <h2>${MONTHS[m - 1]} ${y}</h2>
          <button class="icon-btn" data-action="month" data-m="${next}" aria-label="Nächster Monat">${icon.chevRight}</button>
        </div>
        <div class="cal-grid">
          ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="cal-wd">${w}</span>`).join('')}
          ${cells.join('')}
        </div>
        <div class="cal-legend">
          <span><i class="sw st-full"></i>alles erledigt</span>
          <span><i class="sw st-part"></i>teilweise</span>
          <span><i class="sw st-min"></i>Mindestversion</span>
          <span><i class="sw st-none"></i>nichts</span>
          <span><i class="mk sprechen"></i>Sprechen</span>
          <span><i class="mk test"></i>Wochentest</span>
          <span><i class="mk ms"></i>Meilenstein</span>
        </div>
      </div>
      <p class="muted small center">Tipp auf einen Tag zeigt seine Aufgaben. Du kannst auch nachträglich abhaken.</p>
    </div>`;
}

// ---------- Fortschritt ----------
function viewProgress(t) {
  const weeks = Object.keys(S.tests).map(Number).filter((w) => S.tests[w]?.done).sort((a, b) => a - b);
  const tg = targets(Math.min(17, Math.max(1, weekOf(t))));
  const series = (key) => weeks.map((w) => ({ x: w, y: S.tests[w][key] })).filter((p) => p.y != null && p.y !== '');
  const charts = [
    { title: 'Vokabeltest: sofort gewusst', key: 'quizPct', unit: '%', target: 80, max: 100 },
    { title: 'Verständnis Referenzvideo', key: 'refPct', unit: '%', target: 70, max: 100 },
    { title: 'Input-Stunden pro Woche', key: 'inputHours', unit: ' h', target: tg.inputHours, max: null },
    { title: 'Minuten gesprochen pro Woche', key: 'speakMin', unit: ' Min.', target: tg.speakMin, max: null },
  ];
  const through = introducedThrough(t);
  const totalIntro = through.reduce((s, x) => s + x.count, 0);
  const totalAll = through.reduce((s, x) => s + x.total, 0);

  return `
    <div class="page">
      <header class="page-head"><h1>Fortschritt</h1></header>
      <section>
        <div class="sec-head"><h2>Meilensteine</h2></div>
        <div class="stack">
          ${MILESTONES.map((m) => {
            const done = S.milestones[m.id]?.done;
            const due = m.date <= t;
            return `<div class="card ms-card ${done ? 'done' : ''}">
              <button class="check" data-action="milestone" data-id="${m.id}" aria-label="Erreicht">${icon.check}</button>
              <div><b>${shortDate(m.date)} · Woche ${weekOf(m.date)}</b>${due && !done ? ' <span class="tag">fällig</span>' : ''}
              <ul>${m.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
            </div>`;
          }).join('')}
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>Karten eingeführt (laut Plan)</h2><span class="muted">${totalIntro} von ${totalAll}</span></div>
        <div class="card">
          ${through.map(({ deck, count, total }) => {
            const fin = finishDate(deck, t);
            return `<div class="deck-bar">
              <div class="deck-bar-head"><span><b>${deck.id}</b> ${esc(deck.name)}</span><span class="muted small">${count}/${total}${count >= total ? ' · fertig' : fin ? ` · fertig ca. ${shortDate(fin)}` : ''}</span></div>
              <div class="bar"><span style="width:${total ? (count / total) * 100 : 0}%"></span></div>
            </div>`;
          }).join('')}
          <p class="muted small">Laut Vokabelplan. Dazu kommen deine eigenen Sätze aus Deck 08.</p>
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>Wochentests</h2></div>
        ${weeks.length ? charts.map((c) => `<div class="card chart-card"><b>${c.title}</b>${lineChart(series(c.key), c)}</div>`).join('') : '<div class="card empty">Nach deinem ersten Wochentest siehst du hier deinen Verlauf.</div>'}
        ${weeks.length ? `<div class="card"><table class="tbl"><thead><tr><th>Woche</th><th>Vokabeln</th><th>Video</th><th>Input</th><th>Sprechen</th></tr></thead><tbody>${weeks.map((w) => testResultRows(w)).join('')}</tbody></table></div>` : ''}
      </section>
    </div>`;
}

// ---------- Mehr ----------
function viewMore() {
  const st = getStatus();
  const syncHtml = TEST_MODE
    ? '<p class="muted small">Testmodus (?db=test): eigener Speicher, keine Synchronisierung.</p>'
    : st.email
      ? `<p>Angemeldet als <b>${esc(st.email)}</b></p><p class="muted small" id="sync-state">${syncText(st)}</p>
         <div class="row-btns"><button class="btn ghost" data-action="sync">Jetzt abgleichen</button><button class="btn ghost" data-action="signout">Abmelden</button></div>`
      : `<p class="muted small">Melde dich mit demselben Konto an wie in deiner Karteikarten-App. Dann haben Handy und Laptop denselben Stand.</p>
         <form id="login" class="form">
           <input class="input" type="email" name="email" placeholder="E-Mail" autocomplete="username" required />
           <input class="input" type="password" name="password" placeholder="Passwort" autocomplete="current-password" required />
           <button class="btn primary" type="submit">Anmelden</button>
           <p class="error small" id="login-error"></p>
         </form>`;
  return `
    <div class="page">
      <header class="page-head"><h1>Mehr</h1></header>
      <section>
        <div class="sec-head"><h2>Einstellungen</h2></div>
        <div class="card form">
          <label>Referenzvideo (Easy Korean, 3 Minuten)<input class="input" name="refVideo" value="${esc(S.settings.refVideo)}" placeholder="YouTube-Link mit Startzeit" data-setting="refVideo" /></label>
          <p class="muted small">Jede Woche dieselben 3 Minuten ohne Untertitel schauen und schätzen, wie viel du verstehst.</p>
          <label>Morgens meistens
            <select class="input" data-setting="morning">
              <option value="bus" ${S.settings.morning === 'bus' ? 'selected' : ''}>Bus (Karten am Handy)</option>
              <option value="walk" ${S.settings.morning === 'walk' ? 'selected' : ''}>Laufen (Podcast)</option>
            </select>
          </label>
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>Synchronisierung</h2></div>
        <div class="card">${syncHtml}</div>
      </section>
      <section>
        <div class="sec-head"><h2>Sicherung</h2></div>
        <div class="card">
          <div class="row-btns">
            <button class="btn ghost" data-action="export">Stand exportieren</button>
            <label class="btn ghost">Importieren<input type="file" accept="application/json" id="import" hidden /></label>
          </div>
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>So funktioniert die App</h2></div>
        <div class="card prose small">
          <p>Die App zeigt, was laut deinem Lernplan heute dran ist. Abfragen machst du weiter in deiner Karteikarten-App, hier siehst du nur, welche Karten heute neu sind.</p>
          <p>Welche Karten an welchem Tag neu sind, steht fest im Vokabelplan (auch als Vokabelplan.csv im Koreanisch-Ordner). Der Tagesplan-Agent in der Karteikarten-App legt jeden Tag genau diese Karten ins Deck „Lernen“. Bist du angemeldet, zeigt diese App, ob das schon passiert ist.</p>
          <p>Vorschau auf einen anderen Tag: <code>?datum=2026-11-22</code> an die Adresse hängen.</p>
        </div>
      </section>
    </div>`;
}
function syncText(st) {
  if (st.state === 'syncing') return 'Gleiche ab …';
  if (st.state === 'error' || st.state === 'offline') return st.error ?? 'Fehler beim Abgleich';
  if (st.lastSync) return 'Zuletzt abgeglichen: ' + new Date(st.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return '';
}

// ---------- Ereignisse ----------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, date } = el.dataset;
  if (action === 'toggle') {
    const task = dayTasks(date).tasks.find((t) => t.id === el.dataset.id);
    if (task?.isTest && !task.done && !S.days[date]?.checked?.[task.id]) {
      location.hash = `#/test/${weekOf(date)}`;
      return;
    }
    updateDay(date, (d) => {
      d.checked ??= {};
      if (d.checked[el.dataset.id]) delete d.checked[el.dataset.id];
      else d.checked[el.dataset.id] = true;
    });
    render();
  } else if (action === 'variant') {
    updateDay(date, (d) => (d.morning = el.dataset.v));
    render();
  } else if (action === 'minimal') {
    updateDay(date, (d) => (d.minimal = !d.minimal));
    render();
  } else if (action === 'month') {
    calMonth = el.dataset.m;
    render();
  } else if (action === 'milestone') {
    setMilestone(el.dataset.id, !S.milestones[el.dataset.id]?.done);
    render();
  } else if (action === 'sync') {
    syncNow();
  } else if (action === 'signout') {
    signOut().then(render);
  } else if (action === 'export') {
    const blob = new Blob([JSON.stringify(snapshot(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lernplan-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
});

app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.setting) {
    updateSettings({ [el.dataset.setting]: el.value.trim() });
    toast('Gespeichert');
  } else if (el.id === 'import' && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        if (!data.days || !data.settings) throw new Error();
        if (!confirm('Den aktuellen Stand durch die Datei ersetzen?')) return;
        replaceAll(data);
        toast('Stand importiert');
        render();
      } catch {
        toast('Die Datei ist keine gültige Sicherung.');
      }
    });
  }
});

app.addEventListener('submit', async (e) => {
  if (e.target.id !== 'login') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const err = app.querySelector('#login-error');
  err.textContent = '';
  try {
    await signIn(f.get('email'), f.get('password'));
    toast('Angemeldet');
    render();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

let lastEmail = null;
onStatus((st) => {
  const el = document.getElementById('sync-state');
  if (el) el.textContent = syncText({ ...st });
  // Nach der Anmeldung (auch beim Start) neu zeichnen, damit der Hinweis zum Agenten stimmt
  const email = getStatus().email;
  if (email !== lastEmail) {
    lastEmail = email;
    if (route().name !== 'test') render();
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

// Um Mitternacht oder nach längerer Pause neu zeichnen, damit „Heute“ stimmt
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    render();
  }
});

// ---------- Start ----------
(async function start() {
  if (TEST_MODE) document.body.classList.add('test-mode');
  try {
    await loadDecks();
  } catch (e) {
    console.error(e);
    toast('Decks konnten nicht geladen werden.');
  }
  render();
  initSync(() => render());
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
})();

