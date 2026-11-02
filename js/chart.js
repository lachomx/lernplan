// Einfaches Liniendiagramm als SVG: Werte pro Woche plus gestrichelte Ziellinie.

export function lineChart(points, { unit = '', target = null, max = null }) {
  if (!points.length) return '<p class="muted small">Noch keine Werte.</p>';
  const W = 320, H = 140, L = 34, R = 10, T = 12, B = 24;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs, 1), maxX = Math.max(...xs, minX + 1);
  const top = max ?? (Math.max(target ?? 0, ...points.map((p) => p.y)) * 1.15 || 1);
  const x = (v) => L + ((v - minX) / (maxX - minX)) * (W - L - R);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const ticks = [0, top / 2, top].map((v) => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`).join('');
  const xl = points.map((p) => `<text x="${x(p.x)}" y="${H - 6}" text-anchor="middle">W${p.x}</text>`).join('');
  const dots = points.map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="4"><title>Woche ${p.x}: ${p.y}${unit}</title></circle>`).join('');
  const tl = target != null ? `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" class="target"/><text x="${W - R}" y="${y(target) - 4}" text-anchor="end" class="target-label">Ziel ${target}${unit}</text>` : '';
  const last = points[points.length - 1];
  return `<div class="chart-val">${last.y}${unit} <small class="muted">in Woche ${last.x}</small></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${ticks}${tl}<path d="${path}" class="line"/>${dots}${xl}</svg>`;
}
