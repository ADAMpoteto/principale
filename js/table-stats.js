/* 順位表・記録 */

function vTable() {
  const s = ST.season || D.seasonList[0];
  const st = standing(s, ST.tcomp, false);
  return band("STANDINGS", "順位表", true) + `<div class="wrap narrow">
    ${st && st.comps.length > 1 ? `<div class="pills" id="tcomp">${st.comps.map(c => `<button class="pill${c === st.comp ? " on" : ""}" data-c="${esc(c)}">${compLogo(c, "pill-cl")}${esc(c)}</button>`).join("")}</div>` : ""}
    ${st ? `<div class="tb-v ${ST.tview === "full" ? "full" : "short"}"><div class="tb-head">${compLogo(st.comp, "tb-cl")}<div><b>${esc(st.comp)}</b><small>${esc(s)}シーズン</small></div><div class="tb-tog" id="tview"><button data-v="short" class="${ST.tview !== "full" ? "on" : ""}">ショート</button><button data-v="full" class="${ST.tview === "full" ? "on" : ""}">フル</button></div></div>` + st.html + `</div>` : `<div class="panel">${empty("順位表はまだありません。")}</div>`}
    ${st && (D.rankHist[s + "\t" + st.comp] || []).length > 1 ? sec("POSITION", "順位の推移") + `<div class="chart">${rankChart(D.rankHist[s + "\t" + st.comp], D.table.filter(r => r.season === s && r.comp === st.comp).length)}</div>` : ""}
</div>`;
}
function bTable() { document.querySelectorAll("#tcomp .pill").forEach(b => b.onclick = () => { ST.tcomp = b.dataset.c; render(); }); document.querySelectorAll("#tview button").forEach(b => b.onclick = () => { ST.tview = b.dataset.v; const v = document.querySelector(".tb-v"); v.classList.toggle("full", ST.tview === "full"); v.classList.toggle("short", ST.tview !== "full"); document.querySelectorAll("#tview button").forEach(x => x.classList.toggle("on", x === b)); }); }

function vStats(arg) {
  const s = ST.season, L = ofSeason(s), P = playerAgg(L);
  if (arg) {
    const M = PM.find(x => x.k === arg); if (!M) return `<div class="wrap">${empty("項目が見つかりません。")}</div>`;
    const R = ranked(P, M);
    return band("STATS", M.k, true) + `<div class="wrap narrow"><div class="panel rank-full">${R.map((x, i) => `<a class="rk-row" href="#/player/${pslug(x.p.name)}"><span class="n">${i + 1}</span>${face(x.p.name)}
        <span class="nm">${esc(x.p.name)}<small style="display:block;color:var(--tx3);font-size:12px;font-weight:500">${esc(x.p.pos || "")}　${x.p.apps}試合</small></span><span class="val">${fmtN(x.v, M.d)}${M.u === "%" ? "%" : ""}</span></a>`).join("") || empty("該当する選手がいません。")}</div>
      <p class="back"><a class="btn" href="#/stats">STATS</a></p></div>`;
  }
  if (!["tot", "p90"].includes(ST.sview)) ST.sview = "tot";
  const cards = (ST.sview === "p90" ? PM90 : PM).map(M => rkCard(M, P)).filter(Boolean);
  const TM = teamMetrics(L), tg = {}; TM.forEach(x => (tg[x.g] = tg[x.g] || []).push(x));
  const GE = { 概要: "OVERVIEW", 攻撃: "ATTACK", パス: "PASSING", 守備: "DEFENCE", 規律: "DISCIPLINE" };
  return band("STATS", "記録", true) + `<div class="wrap">
    ${sec("PLAYER STATS", "選手記録")}
    <div class="mtog" id="sview"><button data-v="tot" class="${ST.sview === "tot" ? "on" : ""}">通算</button><button data-v="p90" class="${ST.sview === "p90" ? "on" : ""}">90分あたり</button></div>
    ${ST.sview === "p90" ? `<p class="s90-note">出場時間がチーム最多の選手の30%以上の選手が対象です。</p>` : ""}
    ${cards.length ? `<div class="sgrid">${cards.join("")}</div>` : `<div class="panel">${empty("記録はまだありません。")}</div>`}
    ${L.length > 1 ? sec("GOALS", "試合ごとの得点・失点") + `<div class="chart"><div class="legend"><span><i style="background:var(--blue)"></i>得点</span><span><i style="background:var(--opp)"></i>失点</span></div>${goalsChart(L)}</div>` : ""}
    ${sec("TEAM STATS", "チーム記録")}
    ${TM.length ? Object.keys(tg).map(g => `<div class="panel" style="margin-bottom:20px"><div class="ph">${GE[g] || ""}<small style="margin-left:4px">${esc(g)}</small></div><div class="tiles" style="border:0">
      ${tg[g].map(x => `<div class="tile"><span>${esc(x.k)}</span><b>${fmtN(x.v, x.d)}${x.u ? `<small>${esc(x.u)}</small>` : ""}</b>${x.sub ? `<em>${esc(x.sub)}</em>` : ""}</div>`).join("")}</div></div>`).join("")
      : `<div class="panel">${empty("記録はまだありません。")}</div>`}</div>`;
}

function bStats() { document.querySelectorAll("#sview button").forEach(b => b.onclick = () => { ST.sview = b.dataset.v; render(); }); }
