/* グラフ（SVG）とツールチップ */

/* =====================================================================
   グラフ（SVG）・ツールチップ
   ===================================================================== */
function ratingChart(items) {   /* items: [{m, r}] 試合ごとの評価 */
  if (!items.length) return "";
  const W = 640, H = 170, pl = 26, pr = 6, pt = 10, pb = 22, n = items.length;
  /* 試合が少ないときも間隔を空けすぎない（1試合の幅は最大40）。左から並べる */
  const step = Math.min(40, (W - pl - pr) / n), bw = Math.min(26, step - 6);
  const y = v => pt + (1 - (v - 4) / 6) * (H - pt - pb);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="試合ごとの評価">`;
  [5, 6, 7, 8, 9, 10].forEach(v => { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`; });
  const col = { r9: "#1478c8", r8: "#1d9a55", r7: "#5c9b2a", r6: "#d18a12", r5: "#d6404a" };
  items.forEach((it, i) => {
    const x = pl + i * step + (step - bw) / 2, v = Math.max(4.2, it.r), yy = y(v), h = y(4) - yy;
    s += `<path d="M${x},${y(4)} V${yy + 4} Q${x},${yy} ${x + 4},${yy} H${x + bw - 4} Q${x + bw},${yy} ${x + bw},${yy + 4} V${y(4)} Z" fill="${col[rtCls(it.r)]}"/>`;
    if (n <= 24 || i % Math.ceil(n / 24) === 0) s += `<text class="ax" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${fmtMD(it.m.date)}</text>`;
    s += `<rect class="hit" x="${pl + i * step}" y="${pt}" width="${step}" height="${H - pt - pb}" data-tip="${esc(`<b>${fmtD(it.m.date)} vs ${it.m.opp}</b><br>${scoreTxt(it.m)}（${{ W: "勝", D: "分", L: "敗" }[it.m.res]}）・評価 <b>${fmtN(it.r, 1)}</b>`)}" data-href="#/match/${it.m.id}"/>`;
  });
  return s + `</svg>`;
}
function lineChart(series, opt) {  /* series: [{name, color, dash, pts:[{x:Date, v, tip}]}] */
  const all = series.flatMap(s => s.pts); if (all.length < 2) return "";
  const fm = opt.fmt || (v => v), W = 640, H = 200, pl = opt.fmt ? 52 : 30, pr = 118, pt = 12, pb = 24;
  const xs = all.map(p => +p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v)); let st = 5;
  if (opt.fmt) { const r = (hi - lo) || hi || 1, m = Math.pow(10, Math.floor(Math.log10(r / 4))); st = [1, 2, 2.5, 5, 10].map(k => k * m).find(k => r / k <= 5); lo = Math.max(0, Math.floor(lo / st) * st - (hi === lo ? st : 0)); hi = Math.ceil(hi / st) * st + (hi === lo ? st : 0); }
  else { lo = Math.floor((lo - 2) / 5) * 5; hi = Math.ceil((hi + 1) / 5) * 5; }
  const X = v => pl + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}">`;
  for (let v = lo; v <= hi + 1e-9; v += st) s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${fm(v)}</text>`;
  const ticks = [...new Set(all.map(p => fmtD(p.x)))].map(t => all.find(p => fmtD(p.x) === t).x);
  ticks.forEach((t, i) => { if (ticks.length <= 6 || i % Math.ceil(ticks.length / 6) === 0) s += `<text class="ax" x="${X(+t)}" y="${H - 6}" text-anchor="middle">${t.getFullYear()}/${t.getMonth() + 1}</text>`; });
  series.forEach(sr => {
    if (!sr.pts.length) return;
    s += `<polyline fill="none" stroke="${sr.color}" stroke-width="2" ${sr.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" points="${sr.pts.map(p => `${X(+p.x)},${Y(p.v)}`).join(" ")}"/>`;
    sr.pts.forEach(p => s += `<circle cx="${X(+p.x)}" cy="${Y(p.v)}" r="4" fill="${sr.color}" stroke="#fff" stroke-width="2"/><circle class="hit" cx="${X(+p.x)}" cy="${Y(p.v)}" r="12" data-tip="${esc(p.tip)}"/>`);
    const lp = sr.pts[sr.pts.length - 1];
    s += `<text x="${X(+lp.x) + 9}" y="${Y(lp.v) + 4}" fill="#1c2833" font-size="12" font-weight="700">${esc(sr.name)} ${esc(fm(lp.v))}</text>`;
  });
  return s + `</svg>`;
}
function rankChart(H, n) {   /* 自分の順位の推移（上が1位） */
  const W = 640, Hh = 220, pl = 30, pr = 16, pt = 14, pb = 26, N = Math.max(n, ...H.map(x => x.rank));
  const step = (W - pl - pr) / Math.max(1, H.length - 1), X = i => pl + i * step, Y = r => pt + (r - 1) / Math.max(1, N - 1) * (Hh - pt - pb);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="順位の推移">`;
  [...new Set([1, ...[5, 10, 15, 20, 25].filter(v => v < N), N])].forEach(r => s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(r)}" y2="${Y(r)}"/><text class="ax" x="${pl - 8}" y="${Y(r) + 3}" text-anchor="end">${r}</text>`);
  s += `<polyline fill="none" stroke="#2E86C8" stroke-width="2.5" stroke-linejoin="round" points="${H.map((h, i) => `${X(i)},${Y(h.rank)}`).join(" ")}"/>`;
  H.forEach((h, i) => {
    s += `<circle cx="${X(i)}" cy="${Y(h.rank)}" r="4" fill="#2E86C8" stroke="#fff" stroke-width="2"/>`;
    if (H.length <= 20 || i % Math.ceil(H.length / 20) === 0) s += `<text class="ax" x="${X(i)}" y="${Hh - 8}" text-anchor="middle">${esc(String(h.m.round || i + 1).replace(/^第|節$/g, ""))}</text>`;
    s += `<rect class="hit" x="${X(i) - step / 2}" y="${pt - 8}" width="${step}" height="${Hh - pt - pb + 16}" data-href="#/match/${h.m.id}" data-tip="${esc(`<b>${h.m.round || ""} vs ${h.m.opp}</b><br>${h.m.gf}-${h.m.ga}　→　<b>${h.rank}位</b>`)}"/>`;
  });
  const l = H[H.length - 1]; s += `<text x="${X(H.length - 1)}" y="${Y(l.rank) - 10}" text-anchor="end" font-size="12" font-weight="700" fill="#1c2833">${l.rank}位</text>`;
  return s + `</svg>`;
}
function goalsChart(L) {   /* 試合ごとの得点（上）と失点（下） */
  const W = 640, H = 200, pl = 24, pr = 6, pt = 10, pb = 22, mx = Math.max(3, ...L.map(m => Math.max(m.gf, m.ga)));
  const step = (W - pl - pr) / L.length, bw = Math.max(3, Math.min(18, step - 4)), mid = pt + (H - pt - pb) / 2, u = (H - pt - pb) / 2 / mx;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="試合ごとの得点と失点">`;
  for (let v = 1; v <= mx; v++) if (v === mx || mx <= 4 || v % 2 === 0) { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${mid - v * u}" y2="${mid - v * u}"/><line class="gl" x1="${pl}" x2="${W - pr}" y1="${mid + v * u}" y2="${mid + v * u}"/><text class="ax" x="${pl - 6}" y="${mid - v * u + 3}" text-anchor="end">${v}</text><text class="ax" x="${pl - 6}" y="${mid + v * u + 3}" text-anchor="end">${v}</text>`; }
  L.forEach((m, i) => {
    const x = pl + i * step + (step - bw) / 2;
    if (m.gf) s += `<rect x="${x}" y="${mid - m.gf * u}" width="${bw}" height="${m.gf * u - 1}" fill="#2E86C8"/>`;
    if (m.ga) s += `<rect x="${x}" y="${mid + 1}" width="${bw}" height="${m.ga * u - 1}" fill="#D9702A"/>`;
    if (L.length <= 20 || i % Math.ceil(L.length / 20) === 0) s += `<text class="ax" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${fmtMD(m.date)}</text>`;
    s += `<rect class="hit" x="${pl + i * step}" y="${pt}" width="${step}" height="${H - pt - pb}" data-href="#/match/${m.id}" data-tip="${esc(`<b>${fmtD(m.date)} vs ${m.opp}</b><br>${roundTxt(m)}<br>${m.gf}-${m.ga}`)}"/>`;
  });
  s += `<line x1="${pl}" x2="${W - pr}" y1="${mid}" y2="${mid}" stroke="#8794a1" stroke-width="1"/>`;
  return s + `</svg>`;
}
/* スマホでタップ後に吹き出しが残らないよう、スクロールや他の場所のタップで消す */
document.addEventListener("touchstart", e => { if (!e.target.closest("[data-tip]")) $("tip").hidden = true; }, { passive: true });
window.addEventListener("scroll", () => { const t = $("tip"); if (t && !t.hidden) t.hidden = true; }, { passive: true });
function bindTips(root) {
  const tip = $("tip");
  root.querySelectorAll("[data-tip]").forEach(el => {
    const show = e => { tip.innerHTML = el.dataset.tip; tip.hidden = false; move(e); };
    const move = e => { const x = (e.touches ? e.touches[0] : e).clientX, y = (e.touches ? e.touches[0] : e).clientY; const w = tip.offsetWidth;
      tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + "px"; tip.style.top = (y - tip.offsetHeight - 14) + "px"; };
    el.addEventListener("mouseenter", show); el.addEventListener("mousemove", move); el.addEventListener("mouseleave", () => tip.hidden = true);
    el.addEventListener("click", e => { if (el.dataset.href) location.hash = el.dataset.href; else show(e); });
  });
}
