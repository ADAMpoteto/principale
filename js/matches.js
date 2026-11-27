/* 試合日程・結果、試合詳細、メンバー */

function vMatches() {
  const s = ST.season, M = D.matches.filter(m => !s || m.season === s);
  const comps = ["すべて", ...new Set(M.map(m => m.comp))];
  if (!comps.includes(ST.comp)) ST.comp = "すべて";
  const L = M.filter(m => ST.comp === "すべて" || m.comp === ST.comp);
  /* 試合結果は新しい順、今後の日程は近い順 */
  const P = L.filter(m => m.played).sort((a, b) => b.date - a.date), U = L.filter(m => !m.played).sort((a, b) => (a.date || 0) - (b.date || 0));
  if (!["res", "fix"].includes(ST.mview)) ST.mview = P.length ? "res" : "fix";
  const V = ST.mview === "res" ? P : U;
  const groups = {}; V.forEach(m => { const k = m.date ? `${m.date.getFullYear()}.${pad(m.date.getMonth() + 1)}` : "-"; (groups[k] = groups[k] || []).push(m); });
  const r = record(P);
  return band("MATCHES", "試合日程・結果", true) + `<div class="wrap narrow">
    <div class="mtog" id="mview"><button data-v="res" class="${ST.mview === "res" ? "on" : ""}">試合結果<small>${P.length}</small></button><button data-v="fix" class="${ST.mview === "fix" ? "on" : ""}">今後の日程<small>${U.length}</small></button></div>
    ${comps.length > 2 ? `<div class="pills" id="comp-pills">${comps.map(c => `<button class="pill${c === ST.comp ? " on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${ST.mview === "res" && r.n ? `<p class="mrec">${r.n}試合　${r.w}勝 ${r.d}分 ${r.l}敗　得点 ${r.gf}　失点 ${r.ga}</p>` : ""}
    <div class="mlist">${Object.keys(groups).map(g => `<div class="mh">${esc(g)}</div>${groups[g].map(matchRow).join("")}`).join("") || `<div class="panel">${empty(ST.mview === "res" ? "試合結果はまだありません。" : "今後の試合はありません。")}</div>`}</div></div>`;
}

function bMatches() { document.querySelectorAll("#comp-pills .pill").forEach(b => b.onclick = () => { ST.comp = b.dataset.c; render(); }); document.querySelectorAll("#mview button").forEach(b => b.onclick = () => { ST.mview = b.dataset.v; render(); }); }

/* ---- 試合詳細 ---- */
const CMP = [
  ["主要スタッツ", [["ゴール期待値", 2], ["シュート", 0], ["枠内シュート", 0], ["パス", 0], ["パス成功率", 0, "%"], ["タックル", 0], ["ファウル", 0, "", true], ["コーナーキック", 0], ["警告", 0, "", true], ["退場", 0, "", true]]],
  ["シュート", [["シュート", 0], ["枠内シュート", 0], ["枠外シュート", 0], ["ブロックされたシュート", 0], ["ペナルティエリア内シュート", 0], ["ペナルティエリア外シュート", 0], ["ゴール期待値", 2]]],
  ["パス", [["パス", 0], ["パス成功", 0], ["パス成功率", 0, "%"], ["キーパス", 0], ["クロス", 0], ["スルーパス", 0]]],
  ["守備", [["タックル", 0], ["タックル成功", 0], ["タックル成功率", 0, "%"], ["インターセプト", 0], ["ブロック", 0], ["クリア", 0], ["空中戦勝利", 0], ["セーブ", 0], ["ボール奪取時間", 1, "秒", true]]],
  ["その他", [["ドリブル", 0], ["ドリブル成功", 0], ["ドリブル成功率", 0, "%"], ["コーナーキック", 0], ["フリーキック", 0], ["PK", 0], ["オフサイド", 0, "", true], ["ファウル", 0, "", true], ["警告", 0, "", true], ["退場", 0, "", true], ["走行距離", 1, "km"]]]
];
const SHORT_LAB = { "ブロックされたシュート": "被ブロック", "ペナルティエリア内シュート": "PA内シュート", "ペナルティエリア外シュート": "PA外シュート", "ドリブル成功率": "ドリブル成功率", "ボール奪取時間": "ボール奪取時間" };
function cmpRow(label, a, b, d, u, low) {
  if (a == null && b == null) return "";
  const better = a == null || b == null || a === b ? 0 : ((a > b) !== !!low ? 1 : 2);
  const tot = (a || 0) + (b || 0), pa = tot ? (a || 0) / tot * 100 : 0, pb = tot ? (b || 0) / tot * 100 : 0;
  const f = v => v == null ? "-" : fmtN(v, d) + (u === "%" ? "%" : "");
  return `<div class="crow"><div class="v me${better === 1 ? " win" : ""}"><b>${f(a)}</b></div><div class="lab">${SHORT_LAB[label] ? `<span class="fn">${esc(label)}</span><span class="sn">${esc(SHORT_LAB[label])}</span>` : esc(label)}${u && u !== "%" ? `（${u}）` : ""}</div>
    <div class="v r op${better === 2 ? " win" : ""}"><b>${f(b)}</b></div>
    <div class="bars"><span><i style="width:${pa}%"></i></span><span><i style="width:${pb}%"></i></span></div></div>`;
}
function vMatch(id) {
  const m = D.matches.find(x => x.id === parseInt(id, 10)); if (!m) return `<div class="wrap">${empty("試合が見つかりません。")}</div>`;
  const h = homeAway(m);
  if (!["facts", "stats", "pstats", "lineup"].includes(ST.mtab)) ST.mtab = "facts";
  const evGoals = side => m.ev.filter(e => e.side === side && isGoal(e));
  const goalsTxt = side => {
    const E = evGoals(side);
    if (E.length) return E.map(e => `${esc(e.player)} ${esc(e.min)}'${e.kind === "PKゴール" ? "(PK)" : e.kind === "オウンゴール" ? "(OG)" : ""}`).join("<br>");
    return side === "me" ? m.scorers.map(x => `${esc(x.name)}${x.n > 1 ? ` ×${x.n}` : ""}`).join("<br>") : "";
  };
  const hG = goalsTxt(h.hs), aG = goalsTxt(h.as);
  const club = c => `<div class="club">${logo(c, "lg")}<span>${esc(c)}</span></div>`;
  const tabs = [["facts", "SUMMARY", "概要"], ["stats", "TEAM STATS", "チームスタッツ"], ["pstats", "PLAYER STATS", "選手スタッツ"], ["lineup", "LINE-UP", "メンバー"]];
  let body = "";
  if (m.played) body = ST.mtab === "facts" ? matchFacts(m, h) + headToHead(m) : ST.mtab === "stats" ? matchStats(m, h, false) : ST.mtab === "pstats" ? matchPlayerStats(m, h) : matchLineup(m);
  /* 試合前でもスタメンが入っていれば表示 */
  else body = (ytInfo(m.video) ? `<div class="ph">VIDEO<small>動画</small></div><div class="hlw">${ytBox(m.video, "hl")}</div>` : "") + matchPreview(m, h) + (m.lu.length || m.luOpp.length ? `<div class="ph">LINE-UP<small>メンバー</small></div>${matchLineup(m)}` : "");
  /* 得点者：ホームは右寄せ、アウェイは左寄せでスコアの下に */
  const gl = side => { const E = evGoals(side);
    if (E.length) { /* 1選手1行：時間をまとめる */ const G = []; E.forEach(e => { let g = G.find(x => same(x.name, e.player)); if (!g) G.push(g = { name: e.player, t: [] });
        g.t.push(`${esc(e.min)}'${e.kind === "PKゴール" ? " PK" : e.kind === "オウンゴール" ? " OG" : ""}`); });
      return G.map(g => `<li><span>${esc(g.name)}</span><em>${g.t.join(", ")}</em></li>`).join(""); }
    return side === "me" ? m.scorers.map(x => `<li><span>${esc(x.name)}</span><em>${x.n > 1 ? "×" + x.n : ""}</em></li>`).join("") : ""; };
  const hL = gl(h.hs), aL = gl(h.as);
  const team = (c, lab) => `<div class="mh-team">${logo(c, "xl")}<b>${clubName2(c)}</b><small>${lab}</small></div>`;
  const resLab = { W: "WIN", L: "LOSE", D: "DRAW" }[m.res];
  const info = [["KICK OFF", "キックオフ", m.played ? kickoff(m) : ""], ["STADIUM", "スタジアム", venue(m)], ["WEATHER", "天気", m.weather ? `${WX[m.weather] || ""}${esc(m.weather)}` : ""], ["ATTENDANCE", "観客数", m.att ? fmtN(m.att) + "人" : ""]].filter(x => x[2]);
  return `<section class="mh"><div class="mh-in">
      <div class="mh-top">${compLogo(m.comp, "mh-cl")}<div class="mh-cn">${roundBr(m)}</div></div>
      <div class="mh-date">${dotY(m.date)}</div>
      <div class="mh-vs">${team(h.home, "HOME")}
        <div class="mh-c">${m.played ? `<div class="mh-score"><b>${m.ha === "A" ? m.ga : m.gf}</b><i></i><b>${m.ha === "A" ? m.gf : m.ga}</b></div>
          ${m.pk ? `<div class="mh-pk">PK ${m.ha === "A" ? m.pk.b + " - " + m.pk.a : m.pk.a + " - " + m.pk.b}</div>` : ""}
          <div class="mh-ft">試合終了</div>${resLab ? `<div class="mh-res ${m.res}">${resLab}</div>` : ""}`
        : `<div class="mh-kick">${esc(kickoff(m) || "VS")}</div><div class="mh-ft">${kickoff(m) ? "KICK OFF" : ""}</div>`}</div>
        ${team(h.away, "AWAY")}</div>
      ${m.played && (hL || aL) ? `<div class="mh-goals"><ul class="h">${hL}</ul><ul class="a">${aL}</ul></div>` : ""}
    </div></section>
    ${info.length ? `<div class="mh-info"><div class="mh-info-in">${info.map(([e, j, v]) => `<div><small>${e}<i>${j}</i></small><b>${v.includes("<svg") ? v : esc(v)}</b></div>`).join("")}</div></div>` : ""}
    ${m.played ? `<nav class="mtabs" id="mtabs">${tabs.map(([k, e, j]) => `<a href="javascript:void 0" data-t="${k}" class="${ST.mtab === k ? "on" : ""}">${e}<small>${j}</small></a>`).join("")}</nav>` : ""}
    <div class="wrap narrow" style="--opp:${oppColor(m.opp)}">${body ? `<div class="panel">${body}</div>` : ""}${(() => { const i = D.matches.indexOf(m), pv = D.matches[i - 1], nx = D.matches[i + 1];
      const lk = (x, lab) => x ? `<a class="mnav-a" href="#/match/${x.id}"><small>${lab}</small><b>${esc(x.opp)}</b><span>${dotY(x.date)}${x.played ? `　${x.gf}-${x.ga}` : ""}</span></a>` : "<span></span>";
      return `<nav class="mnav">${lk(pv, "‹ 前の試合")}<a class="btn" href="#/matches">MATCHES</a>${lk(nx, "次の試合 ›")}</nav>`; })()}</div>`;
}
function bMatch() { document.querySelectorAll("#mtabs a").forEach(a => a.onclick = () => { ST.mtab = a.dataset.t; render(); }); }
/* ある日より前の、そのクラブの直近の結果（自分の試合＋他クラブの試合） */
function clubForm(club, before, n) {
  const R = [];
  if (isMe(club)) D.played.forEach(x => { if (x.date && x.date < before) R.push({ d: x.date, r: x.res }); });
  else {
    D.played.forEach(x => { if (same(x.opp, club) && x.date && x.date < before) R.push({ d: x.date, r: x.res === "W" ? "L" : x.res === "L" ? "W" : "D" }); });
    (D.ox || []).forEach(x => { if (!x.date || x.date >= before) return; const f = same(x.home, club) ? [x.hg, x.ag] : same(x.away, club) ? [x.ag, x.hg] : null;
      if (f) R.push({ d: x.date, r: f[0] > f[1] ? "W" : f[0] < f[1] ? "L" : "D" }); });
  }
  return R.sort((a, b) => b.d - a.d).slice(0, n || 5).reverse().map(x => x.r);
}
/* 試合前のプレビュー：順位・直近5試合・得失点の比較と注目選手 */
function matchPreview(m, h) {
  const lg = leagueOfSeason(m.season) || m.comp;
  const T = D.table.filter(r => r.season === m.season && r.comp === lg), row = c => T.find(r => isMe(c) ? isMe(r.club) : same(r.club, c));
  const cl = [h.home, h.away], R = cl.map(row), F = cl.map(c => clubForm(c, m.date || new Date(8.64e15)));
  const chips = f => f.length ? `<span class="form5">${f.map(x => `<span class="wdl ${x}">${x}</span>`).join("")}</span>` : "-";
  const line = (lab, a, b) => `<div class="pv-r"><div class="a">${a}</div><div class="k">${lab}</div><div class="b">${b}</div></div>`;
  const rows = [];
  if (R[0] || R[1]) {
    rows.push(line(`${esc(lg)} 順位`, R[0] ? `<b>${R[0].rank}</b><small>位</small>` : "-", R[1] ? `<b>${R[1].rank}</b><small>位</small>` : "-"));
    rows.push(line("勝点", R[0] ? `<b>${R[0].pts}</b>` : "-", R[1] ? `<b>${R[1].pts}</b>` : "-"));
    rows.push(line("勝 / 分 / 敗", R[0] ? `${R[0].w} / ${R[0].d} / ${R[0].l}` : "-", R[1] ? `${R[1].w} / ${R[1].d} / ${R[1].l}` : "-"));
    rows.push(line("得点 / 失点", R[0] ? `${R[0].gf} / ${R[0].ga}` : "-", R[1] ? `${R[1].gf} / ${R[1].ga}` : "-"));
  }
  /* 注目選手：今シーズンここまでの得点・アシストの1位 */
  const tot = {}; D.played.filter(x => x.season === m.season && x.date < (m.date || new Date(8.64e15))).forEach(x => x.lu.forEach(l => {
    const t = tot[nameKey(l.name)] || (tot[nameKey(l.name)] = { name: l.name, g: 0, a: 0, n: 0 }); t.g += l.s["得点"] || 0; t.a += l.s["アシスト"] || 0; t.n++; }));
  const top = k => Object.values(tot).filter(t => t[k] > 0).sort((a, b) => b[k] - a[k])[0];
  const kp = [["チーム得点王", top("g"), "g", "ゴール"], ["チームアシスト王", top("a"), "a", "アシスト"]].filter(x => x[1]);
  /* 欠場予定：試合の日に負傷で離脱中の自チームの選手 */
  const ab = m.date ? [...new Map((D.inj || []).filter(x => injAt(x.name, m.date) === x).map(x => [nameKey(x.name), x])).values()] : [];
  if (!rows.length && !kp.length && !ab.length && !headToHead(m)) return "";
  return `<div class="ph">PREVIEW<small>プレビュー</small></div>
    ${rows.length ? `<div class="pv"><div class="pv-h"><div>${logo(cl[0], "md")}</div><div>${logo(cl[1], "md")}</div></div>${rows.join("")}</div>` : ""}
    ${headToHead(m)}
    ${kp.length ? `<div class="ph">KEY PLAYERS<small>注目選手</small></div><div class="kp">${kp.map(([lab, t, k, u]) => `<a class="kp-c" href="#/player/${pslug(t.name)}">${face(t.name)}<div><span>${lab}</span><b>${esc(t.name)}</b><em>${t[k]}<small>${u}</small></em></div></a>`).join("")}</div>` : ""}
    ${ab.length ? `<div class="ph">ABSENCES<small>負傷で欠場予定の選手</small></div><div class="inj-ab">${ab.map(x => `<a href="#/player/${pslug(x.name)}">${face(x.name)}<div><b>${esc(x.name)}</b><small>${esc(x.what || "負傷")}${x.back ? `・${md(x.back)}ごろ復帰予定` : ""}</small></div></a>`).join("")}</div>` : ""}`;
}
function headToHead(m) {
  const L = D.played.filter(x => same(x.opp, m.opp) && x !== m && (!m.date || !x.date || x.date < m.date));
  if (!L.length) return `<div class="ph">対戦成績<small>HEAD TO HEAD</small></div><div class="h2s h2s-first">${logo(clubName(), "md")}<p><b>${esc(clubName())}として初めての対戦</b><small>${esc(m.opp)}との対戦記録はまだありません</small></p>${logo(m.opp, "md")}</div>`;
  const r = record(L), pc = v => r.n ? v / r.n * 100 : 0, me = clubName();
  const ha = k => { const q = record(L.filter(x => x.ha === k)); return q.n ? `${q.w}勝${q.d}分${q.l}敗` : "-"; };
  const bw = L.filter(x => x.res === "W").sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const sc = {}; L.forEach(x => x.scorers.filter(y => !/オウン/.test(y.name)).forEach(y => { const k = nameKey(y.name); (sc[k] = sc[k] || { name: y.name, n: 0 }).n += y.n; }));
  const top = Object.values(sc).sort((a, b) => b.n - a.n).slice(0, 3);
  const cell = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<div class="ph">対戦成績<small>通算${r.n}試合</small></div>
    <div class="h2s"><div class="h2s-top"><div class="h2s-t">${logo(me, "md")}<b>${r.w}</b><small>${esc(shortOf(me))} 勝利</small></div>
      <div class="h2s-t d"><b>${r.d}</b><small>引き分け</small></div><div class="h2s-t">${logo(m.opp, "md")}<b>${r.l}</b><small>${esc(shortOf(m.opp))} 勝利</small></div></div>
      <div class="h2s-bar"><i class="w" style="width:${pc(r.w)}%"></i><i class="d" style="width:${pc(r.d)}%"></i><i class="l" style="width:${pc(r.l)}%"></i></div>
      <div class="h2s-g">${cell("得点", `${r.gf}<small>（1試合 ${fmtN(r.gf / r.n, 1)}）</small>`)}${cell("失点", `${r.ga}<small>（1試合 ${fmtN(r.ga / r.n, 1)}）</small>`)}
        ${cell("ホーム", ha("H"))}${cell("アウェイ", ha("A"))}${bw ? cell("最多得点差勝利", `<a href="#/match/${bw.id}">${bw.gf}-${bw.ga}<small>（${dotY(bw.date)}）</small></a>`) : ""}
        ${top.length ? cell("この相手からの得点", top.map(t => `<a class="nw" href="#/player/${pslug(t.name)}">${esc(t.name)}<small> ${t.n}点</small></a>`).join("、")) : ""}</div></div>
    <div class="ph">直近の対戦<small>RECENT</small></div><div class="mlist h2h">${L.slice(-5).reverse().map(matchRow).join("")}</div>`;
}
function matchFacts(m, h) {
  const evs = m.ev.filter(e => e.kind !== "その他" || e.note || e.video);
  const SVG = d => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const EI = { セーブ: SVG('<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L3.5 15a1.5 1.5 0 0 1 2.3-1.9L8 15"/>'), "シュート（枠外）": SVG('<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'), "シュート（セーブ）": SVG('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'), "シュート（ブロック）": SVG('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>'),
    "ポスト・バー": SVG('<path d="M4 20V5h16v15"/><circle cx="17" cy="8" r="2.4" fill="currentColor"/>'), 
    オフサイド: SVG('<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>'), ビッグチャンス: SVG('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
    PK失敗: SVG('<circle cx="12" cy="12" r="8"/><path d="M8 8l8 8M16 8l-8 8"/>'), 負傷: SVG('<path d="M12 5v14M5 12h14"/>'), VAR: SVG('<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8"/>') };
  const icon = e => `<span class="ico${e.kind === "シュート（枠外）" ? " miss" : ""}">${isGoal(e) ? ICON.ball : e.kind === "負傷" ? INJ_MARK : e.kind === "警告" ? `<i class="cardY"></i>` : e.kind === "退場" ? `<i class="cardR"></i>` : e.kind === "交代" ? ICON.sub : EI[e.kind] || ""}</span>`;
  const LBL = { セーブ: "セーブ", "シュート（枠外）": "シュート（枠外）", "シュート（セーブ）": "シュート（セーブされる）", "シュート（ブロック）": "シュート（ブロックされる）", "ポスト・バー": "ポスト・バー直撃", オフサイド: "オフサイド", ビッグチャンス: "決定機", PK失敗: "PK失敗", 負傷: "負傷", VAR: "VAR" };
  const evTxt = e => {
    const nm = e.player ? (e.side === "me" ? pLink(e.player) : esc(e.player)) : `<span class="ev-k">${esc(LBL[e.kind] || e.kind)}</span>`;
    const parts = e.kind === "交代" ? [`OUT ${esc(e.rel)}`] : isGoal(e) ? [e.kind === "PKゴール" ? "PK" : e.kind === "オウンゴール" ? "オウンゴール" : "", e.rel ? `アシスト：<span class="nw">${esc(e.rel)}</span>` : ""]
      : e.kind === "セーブ" ? [e.rel ? `シュート：${esc(e.rel)}` : ""] : e.kind === "シュート（セーブ）" ? [e.player ? LBL[e.kind] : "", e.rel ? `GK：${esc(e.rel)}` : ""] : e.kind === "シュート（ブロック）" ? [e.player ? LBL[e.kind] : "", e.rel ? `ブロック：${esc(e.rel)}` : ""] : e.kind === "シュート（枠外）" ? [e.rel ? esc(e.rel) : ""] : LBL[e.kind] && e.player ? [LBL[e.kind], e.rel ? esc(e.rel) : ""] : [e.rel ? esc(e.rel) : ""];
    if (e.note) parts.push(esc(e.note));
    const sub = parts.filter(Boolean).join("　");
    return `<div>${nm}${sub ? `<small>${sub}</small>` : ""}</div>`;
  };
  const vbtn = e => ytInfo(e.video) ? `<button type="button" class="ev-vb" onclick="const v=this.closest('.ev').nextElementSibling;v.hidden=!v.hidden;if(!v.hidden)ytPlay(v.firstElementChild)" aria-label="動画を見る"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M7 4v16l13-8z" fill="currentColor"/></svg><span>動画</span></button>` : "";
  const hasPhase = evs.some(e => PHASE[e.kind]);
  let ht = false, a = 0, b = 0;
  const sc = () => h.hs === "me" ? `${a} - ${b}` : `${b} - ${a}`;
  let pa = 0, pb = 0; /* PK戦のスコア（自分・相手） */
  const tl = evs.map(e => {
    if (/^PK戦（/.test(e.kind)) { const ok = /成功/.test(e.kind); if (ok) e.side === "me" ? pa++ : pb++;
      const left = (e.side === "me") === (h.hs === "me"), sc2 = h.hs === "me" ? `${pa}-${pb}` : `${pb}-${pa}`;
      const ic = `<span class="ico pk-ic ${ok ? "ok" : "ng"}">${ok ? ICON.ball : SVG('<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>')}</span>`;
      const nm = e.player ? (e.side === "me" ? pLink(e.player) : esc(e.player)) : `<span class="ev-k">${ok ? "成功" : "失敗"}</span>`;
      const tx = `<div>${nm}<small>${ok ? "成功" : "失敗"}${e.note ? "　" + esc(e.note) : ""}</small></div>`;
      return `<div class="ev pk-row"><div class="l">${left ? tx + ic : ""}</div><div class="m pk-sc">${sc2}</div><div class="r">${left ? "" : ic + tx}</div></div>`; }
    if (PHASE[e.kind]) { const ft = e.kind === "試合終了", score = !["キックオフ", "PK戦"].includes(e.kind);
      return `<div class="ev-ph${ft ? " ft" : ""}"><b>${PHASE[e.kind][0]}</b>${score ? `<span>${ft ? scoreTxt(m) + (m.pk ? `　PK ${h.hs === "me" ? m.pk.a + "-" + m.pk.b : m.pk.b + "-" + m.pk.a}` : "") : sc()}</span>` : ""}${e.min && !ft && e.kind !== "キックオフ" ? `<small>${esc(e.min)}'</small>` : ""}${e.note ? `<small>${esc(e.note)}</small>` : ""}</div>`; }
    let pre = ""; if (!hasPhase && !ht && e.mn > 45.99 && e.mn < 999) { ht = true; pre = `<div class="ev-ph"><b>HALF TIME</b><span>${sc()}</span></div>`; }
    if (isGoal(e)) e.side === "me" ? a++ : b++;
    const left = (e.side === "me") === (h.hs === "me"), minor = MINOR.includes(e.kind);
    return pre + `<div class="ev${minor ? " minor" : ""}${isGoal(e) ? " goal" : ""}"><div class="l">${left ? vbtn(e) + evTxt(e) + icon(e) : ""}</div><div class="m">${esc(e.min)}${e.min ? "'" : ""}</div><div class="r">${left ? "" : icon(e) + evTxt(e) + vbtn(e)}</div></div>`
      + (vbtn(e) ? `<div class="ev-v" hidden>${ytBox(e.video)}</div>` : "");
  }).join("");
  const nMinor = evs.filter(e => MINOR.includes(e.kind)).length;
  const tlHead = `<div class="ph">試合経過</div>`;
  const hl = ytBox(m.video, "hl");
  const mom = m.mom ? (() => { const l = m.momL, op = l && l.side === "opp";
    const inner = `<div class="mom-ph${op ? " op" : ""}">${op ? logo(m.opp, "") : face(m.mom)}</div><div class="mom-tx"><span>MAN OF THE MATCH</span><b>${esc(m.mom)}</b><small>${[l && l.no != null ? "#" + l.no : "", l ? l.pos : "", op ? m.opp : ""].filter(Boolean).map(esc).join("　")}</small></div>${l && l.rating != null ? `<div class="mom-rt"><small>RATING</small><b>${fmtN(l.rating, 1)}</b></div>` : ""}`;
    return op ? `<div class="mom">${inner}</div>` : `<a class="mom" href="#/player/${pslug(m.mom)}">${inner}</a>`; })() : "";
  const stats = "";
  return `${hl ? `<div class="ph">HIGHLIGHTS<small>ハイライト</small></div><div class="hlw">${hl}</div>` : ""}${mom}${tl ? `<div class="evw">${tlHead}${tl}</div>` : ""}${stats}${m.memo ? `<p style="padding:14px 18px;margin:0;color:var(--tx2)">${esc(m.memo)}</p>` : ""}
    ${!mom && !tl && !stats && !hl ? empty("試合の詳細はまだありません。") : ""}`;
}
/* 選手スタッツ：出場した両チームの選手を項目ごとにランキング */
const PSTAT = [["評価", 1], ["得点", 0], ["アシスト", 0], ["ゴール期待値", 2], ["シュート", 0], ["枠内シュート", 0], ["キーパス", 0], ["パス成功", 0], ["パス成功率", 0, "%"],
  ["ドリブル成功", 0], ["タックル成功", 0], ["インターセプト", 0], ["ブロック", 0], ["クリア", 0], ["セーブ", 0], ["走行距離", 1, "km"]];
function matchPlayerStats(m, h) {
  const all = [...m.lu, ...m.luOpp];
  const val = (l, k) => k === "評価" ? l.rating : k === "パス成功率" ? ((l.s["パス"] || 0) >= 5 && l.s["パス成功"] != null && l.s["パス成功"] <= l.s["パス"] ? l.s["パス成功"] / l.s["パス"] * 100 : null) : l.s[k];
  const cards = PSTAT.map(([k, d, u]) => {
    const L = all.map(l => ({ l, v: val(l, k) })).filter(x => x.v != null && x.v > 0).sort((a, b) => b.v - a.v || (b.l.rating ?? 0) - (a.l.rating ?? 0));
    if (!L.length) return "";
    let rank = 0, prev = null;
    const rows = L.map((x, i) => { if (x.v !== prev) { rank = i + 1; prev = x.v; } const op = x.l.side === "opp", c = op ? m.opp : clubName();
      const inner = `<span class="ps-rk">${rank}</span>${face(x.l.name, "ps-f", x.l.no)}<span class="ps-nm"><b>${esc(x.l.name)}</b><small>${logo(c, "xs")}${esc(shortOf(c))}${playedPos(m, x.l) ? "　" + esc(playedPos(m, x.l)) : ""}</small></span>${k === "評価" ? `<span class="ps-v">${rtChip(x.v)}</span>` : `<span class="ps-v">${fmtN(x.v, d)}${u === "%" ? "%" : ""}</span>`}`;
      const cls = `ps-r${rank === 1 ? " is-1" : ""}${i >= 5 ? " more" : i >= 3 ? " m-more" : ""}`;
      return op ? `<div class="${cls}">${inner}</div>` : `<a class="${cls}" href="#/player/${pslug(x.l.name)}">${inner}</a>`; }).join("");
    return `<div class="ps-c"><h3>${esc(k)}${u && u !== "%" ? `<small>（${u}）</small>` : ""}</h3>${rows}${L.length > 3 ? `<button class="ps-more${L.length > 5 ? "" : " m-only"}" type="button" onclick="this.parentNode.classList.toggle('open');this.textContent=this.parentNode.classList.contains('open')?'閉じる':'すべて見る（${L.length}人）'">すべて見る（${L.length}人）</button>` : ""}</div>`; }).join("");
  if (!cards) return empty("選手スタッツはまだありません。");
  return `<div class="ph">項目別ランキング<small>PLAYER STATS</small></div><div class="ps">${cards}</div>`;
}
/* 選手評価（選手スタッツタブ） */
function matchRatings(m, h) {
  const all = side => (side === "me" ? m.lu : m.luOpp).filter(l => l.rating != null).sort((a, b) => b.rating - a.rating);
  const best = Math.max(-1, ...[...m.lu, ...m.luOpp].map(l => l.rating ?? -1));
  const col = side => { const L = all(side), c = side === "me" ? clubName() : m.opp; if (!L.length) return "";
    return `<div class="pr-col"><div class="pr-h">${logo(c, "sm")}<b>${esc(c)}</b><small>平均 ${fmtN(L.reduce((a, l) => a + l.rating, 0) / L.length, 2)}</small></div>
      ${L.map(l => { const inner = `<span class="pr-no">${l.no ?? ""}</span><span class="pr-nm"><b>${esc(l.name)}</b><small>${esc(playedPos(m, l) || "")}${l.role === "途中出場" ? "　途中出場" : ""}${l.s["出場時間"] != null ? "　" + l.s["出場時間"] + "分" : ""}</small></span>${l.rating === best ? `<span class="pr-best">BEST</span>` : ""}${rtChip(l.rating)}`;
        return side === "me" ? `<a class="pr-row" href="#/player/${pslug(l.name)}">${inner}</a>` : `<div class="pr-row">${inner}</div>`; }).join("")}</div>`; };
  const a = col(h.hs), b = col(h.as);
  return a || b ? `<div class="ph">選手評価<small>PLAYER RATINGS</small></div><div class="pr">${a}${b}</div>` : "";
}
function matchStats(m, h, short) {
  const H = h.hs, A = h.as;
  const pa = tv(m, H, "ボール支配率"), pb = tv(m, A, "ボール支配率");
  const groups = short ? [CMP[0]] : CMP.slice(1);
  const body = groups.map(([g, L]) => { const rows = L.map(([k, d, u, low]) => cmpRow(k, tv(m, H, k), tv(m, A, k), d, u, low)).join(""); return rows ? `<div class="cmp-sec">${short ? "" : `<h3>${esc(g)}</h3>`}${rows}</div>` : ""; }).join("");
  if (!body && pa == null && pb == null) return short ? "" : empty("スタッツはまだありません。");
  const poss = (pa != null || pb != null) ? (() => { const a = pa ?? 100 - pb, b = pb ?? 100 - pa; return `<div class="cmp-sec"><h3>ボール支配率</h3><div class="poss"><div style="flex:${a}">${fmtN(a)}%</div><div style="flex:${b}">${fmtN(b)}%</div></div></div>`; })() : "";
  const fm = k => m.form[k] ? `<small>${esc(m.form[k])}</small>` : "";
  return `<div class="cmpw${H === "opp" ? " sw" : ""}">${short ? `<div class="ph">スタッツ<a href="javascript:void 0" onclick="ST.mtab='stats';render()">すべて見る</a></div>` : ""}
    <div class="cmp-legend"><span><i style="background:var(--cl)"></i>${clubName2(H === "me" ? clubName() : m.opp)} ${fm(H)}</span><span>${fm(A)} ${clubName2(A === "me" ? clubName() : m.opp)}<i style="background:var(--cr)"></i></span></div>
    ${poss}${body}</div>`;
}
const POSXY = { GK: [50, 91], SW: [50, 82], RB: [86, 78], RCB: [64, 78], CB: [50, 79], LCB: [36, 78], LB: [14, 78], RWB: [88, 68], LWB: [12, 68],
  CDM: [50, 64], RDM: [66, 64], LDM: [34, 64], CM: [50, 52], RCM: [70, 53], LCM: [30, 53], RM: [88, 46], LM: [12, 46], CAM: [50, 38], RAM: [70, 38], LAM: [30, 38],
  RW: [84, 24], LW: [16, 24], RF: [66, 20], LF: [34, 20], CF: [50, 22], ST: [50, 15], RS: [64, 15], LS: [36, 15] };
/* ピッチのライン（105×68） */
const PITCH_SVG = `<svg class="lp-lines" viewBox="0 0 105 68" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".35">
  <rect x="2" y="2" width="101" height="64"/><line x1="52.5" y1="2" x2="52.5" y2="66"/><circle cx="52.5" cy="34" r="8.5"/><circle cx="52.5" cy="34" r=".5" fill="rgba(255,255,255,.55)"/>
  <rect x="2" y="14.4" width="16" height="39.2"/><rect x="2" y="24.1" width="5.4" height="19.8"/><circle cx="12.8" cy="34" r=".5" fill="rgba(255,255,255,.55)"/><path d="M18 27.4a8.5 8.5 0 0 1 0 13.2"/>
  <rect x="87" y="14.4" width="16" height="39.2"/><rect x="97.6" y="24.1" width="5.4" height="19.8"/><circle cx="92.2" cy="34" r=".5" fill="rgba(255,255,255,.55)"/><path d="M87 27.4a8.5 8.5 0 0 0 0 13.2"/>
  <rect x=".6" y="30.3" width="1.4" height="7.4"/><rect x="103" y="30.3" width="1.4" height="7.4"/></svg>`;
/* スマホ用：縦向きのピッチ（68×105） */
const PITCH_SVG_V = PITCH_SVG.replace('viewBox="0 0 105 68"', 'viewBox="0 0 68 105"').replace(/(<svg[^>]*>)/, '$1<g transform="translate(68 0) rotate(90)">').replace("</svg>", "</g></svg>");
function matchLineup(m) {
  if (!m.lu.length && !m.luOpp.length) return empty("メンバーの記録はありません。");
  const h = homeAway(m), L = side => side === "me" ? m.lu : m.luOpp, B = side => side === "me" ? m.bench : m.benchOpp;
  const club = side => side === "me" ? clubName() : m.opp;
  const link = (l, inner, cls) => l.side !== "opp" ? `<a class="${cls}" href="#/player/${pslug(l.name)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  /* 控え欄：ゴールとアシストを「アイコン＋数」で */
  const gIcon = l => { const g = l.s["得点"] ?? m.ev.filter(e => isGoal(e) && e.kind !== "オウンゴール" && mine(l, e)).length, a = l.s["アシスト"] ?? m.ev.filter(e => isGoal(e) && e.side === l.side && same(e.rel, l.name)).length;
    return (g ? `<span class="sb-st">${ICON.ball}${g > 1 ? `<b>${g}</b>` : ""}</span>` : "") + (a ? `<span class="sb-st a"><img src="images/icon/boot.png" alt="">${a > 1 ? `<b>${a}</b>` : ""}</span>` : ""); };
  /* ピッチ上のバッジ（FotMob風）：右上 評価／右下 ゴール／左下 アシスト／左 カード／左上 交代時間 */
  const mine = (l, e) => e.side === l.side && same(e.player, l.name);
  const BOOT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 15.5c0-1 .6-1.8 1.6-2l4.4-.9 2.2-4.6h4l.8 3.4 5.2 1.6c.8.3 1.3 1 1.3 1.9v1.6H2.5z" fill="currentColor"/><path d="M4 19h2M9 19h2M14 19h2M19 19h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const badges = l => {
    const goals = l.s["得点"] ?? m.ev.filter(e => isGoal(e) && e.kind !== "オウンゴール" && mine(l, e)).length;
    const ast = l.s["アシスト"] ?? m.ev.filter(e => isGoal(e) && e.side === l.side && same(e.rel, l.name)).length;
    /* カード・交代は試合経過が優先、なければ出場選手シートの「警告」「退場」「出場時間」から */
    const yc = Math.max(m.ev.filter(e => e.kind === "警告" && mine(l, e)).length, +l.s["警告"] || 0);
    const rc = m.ev.some(e => e.kind === "退場" && mine(l, e)) || +l.s["退場"] > 0 || yc >= 2;
    const mins = l.s["出場時間"], evOff = m.ev.find(e => e.kind === "交代" && e.side === l.side && same(e.rel, l.name));
    const off = evOff || (!rc && l.role === "先発" && mins != null && mins > 0 && mins < 90 ? { min: String(mins) } : null);
    return rtChip(l.rating, "bd b-tr")
      + (goals ? `<span class="bd b-br b-g"><i><img src="images/icon/ball.png" alt=""></i>${goals > 1 ? `<b>${goals}</b>` : ""}</span>` : "")
      + (ast ? `<span class="bd b-bl b-a"><i><img src="images/icon/boot.png" alt=""></i>${ast > 1 ? `<b>${ast}</b>` : ""}</span>` : "")
      + (rc ? `<i class="bd b-ml b-card r"></i>` : yc ? `<i class="bd b-ml b-card y"></i>` : "")
      + (off ? `<span class="bd b-tl b-off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>${off.min ? esc(String(off.min).replace(/分$/, "")) + "'" : ""}</span>` : "");
  };
  /* ラインごとに人数を数えて横位置を決める（4バック／5バック、2ボランチ／3ボランチなどで変わる） */
  const ROWS = [["LB", "LCB", "CB", "RCB", "RB"], ["LDM", "CDM", "RDM"], ["LM", "LCM", "CM", "RCM", "RM"], ["LAM", "CAM", "RAM"], ["LF", "CF", "RF", "LS", "ST", "RS"]];
  const WIDE = { LB: 14, RB: 86, LM: 12, RM: 88 }, SPREAD = { 1: [50], 2: [35, 65], 3: [27, 50, 73], 4: [20, 40, 60, 80] };
  const xMap = {};
  const lineX = side => xMap[side] || (xMap[side] = (() => { const P = new Set(L(side).filter(l => l.role === "先発").map(l => l.pos)), r = {};
    /* 両サイド（LB・RB など）がいる列は、内側の選手を少し中に寄せて重ならないようにする */
    const INNER = { 1: [50], 2: [38, 62], 3: [32, 50, 68], 4: [28, 43, 57, 72] };
    ROWS.forEach(row => { const c = row.filter(q => P.has(q) && !(q in WIDE)), wide = row.some(q => P.has(q) && q in WIDE);
      c.forEach((q, i) => r[q] = ((wide ? INNER : SPREAD)[c.length] || SPREAD[4])[i]); });
    return r; })());
  /* 5バック（センターバック3枚）のときの LB・RB は少し高い位置（ウイングバック） */
  const back3 = side => { const P = L(side).filter(l => l.role === "先発").map(l => l.pos); return P.includes("LCB") && P.includes("RCB") && P.includes("CB"); };
  const baseXY0 = pos => POSXY[pos] || POSXY[{ GK: "GK", DF: "CB", MF: "CM", FW: "ST" }[pos]] || [50, 50];
  let curSide = "";
  const baseXY = pos => { const b = baseXY0(pos); return (pos === "LB" || pos === "RB") && curSide && back3(curSide) ? [b[0], 72] : b; };
  /* 縦の位置：いるラインだけを等間隔に並べる（空いたラインで間延びしない） */
  const yMap = {};
  const lineY = side => yMap[side] || (yMap[side] = (() => { curSide = side;
    const ys = [...new Set(L(side).filter(l => l.role === "先発" && l.pos !== "GK").map(l => baseXY(l.pos)[1]))].sort((a, b) => a - b), g = [];
    ys.forEach(y => { const last = g[g.length - 1]; if (last && y - last.min <= 8) last.ys.push(y); else g.push({ min: y, ys: [y] }); });
    const r = {}; g.forEach((gr, i) => { const base = g.length > 1 ? 14 + i * 60 / (g.length - 1) : 44; gr.ys.forEach(y => r[y] = base + (y - gr.min) * 0.6); });
    return r; })());
  const posXY = (pos, side) => { curSide = side; const b = baseXY(pos), x = lineX(side)[pos];
    return [x ?? b[0], pos === "GK" ? b[1] : lineY(side)[b[1]] ?? b[1]]; };
  /* 1枚のピッチに両チーム（ホームは下、アウェイは上） */
  const dots = (side, top) => { const used = {};
    return L(side).filter(l => l.role === "先発").map(l => {
      let [x, y] = posXY(l.pos, side);
      const k = x + "," + y; used[k] = (used[k] || 0) + 1; x += (used[k] - 1) * 14 * (used[k] % 2 ? 1 : -1);
      /* 横向きのピッチ：ホームは左から右へ、アウェイは右から左へ攻める */
      const dep = l.pos === "GK" ? 6.5 : 16 + Math.max(0, Math.min(1, (74 - y) / 60)) * 29;
      const X = top ? 100 - dep : dep, Y = Math.max(9, Math.min(91, top ? 100 - x : x));
      return link(l, `<span class="lp-ph">${face(l.name, "", l.no)}${badges(l)}</span><span class="lp-nm">${hurtIn(m, l) ? INJ_MARK : ""}${l.no != null ? `<b>${l.no}</b>` : ""}${esc(l.name)}</span>`, `lp ${side}${X > 78 ? " rl" : ""}`).replace(/^<(a|div) class="([^"]+)"/, `<$1 class="$2" style="left:${X}%;top:${Y}%"`);
    }).join(""); };
  /* スマホ：チームごとに縦向きで表示（自チームは下から上へ攻める） */
  const vdots = side => { const used = {};
    return L(side).filter(l => l.role === "先発").map(l => {
      let [x, y] = posXY(l.pos, side);
      const k = x + "," + y; used[k] = (used[k] || 0) + 1; x += (used[k] - 1) * 14 * (used[k] % 2 ? 1 : -1);
      const X = Math.max(10, Math.min(90, x)), Y = l.pos === "GK" ? 92 : Math.max(9, Math.min(84, y));
      return link(l, `<span class="lp-ph">${face(l.name, "", l.no)}${badges(l)}</span><span class="lp-nm">${hurtIn(m, l) ? INJ_MARK : ""}${l.no != null ? `<b>${l.no}</b>` : ""}${esc(l.name)}</span>`, `lp ${side}${X > 78 ? " rl" : ""}`).replace(/^<(a|div) class="([^"]+)"/, `<$1 class="$2" style="left:${X}%;top:${Y}%"`);
    }).join(""); };
  const t0 = h.hs === "me" ? 0 : 1; /* スマホは自チームのタブを最初に開く */
  const tab = (side, i) => `<button type="button" class="lpm-tab${i === t0 ? " on" : ""}" onclick="const u=this.closest('.lu');u.dataset.t='${i}';u.querySelectorAll('.lpm-tab').forEach((b,j)=>b.classList.toggle('on',j==${i}))">${logo(club(side), "sm")}<b>${esc(shortOf(club(side)))}</b><small>${esc(m.form[side] || "")}</small></button>`;
  const mob = `<div class="lpm"><div class="lpm-tabs">${tab(h.hs, 0)}${tab(h.as, 1)}</div>
    ${[h.hs, h.as].map((sd, i) => `<div class="lpm-field s${i}">${PITCH_SVG_V}${vdots(sd) || `<p class="lpm-none">メンバーの記録はありません</p>`}</div>`).join("")}</div>`;
  const pitch = mob + `<div class="lpitch"><div class="lp-team"><span>${logo(club(h.hs), "sm")}${esc(club(h.hs))}<small>${esc(m.form[h.hs] || "")}</small></span><span><small>${esc(m.form[h.as] || "")}</small>${esc(club(h.as))}${logo(club(h.as), "sm")}</span></div>
    <div class="lp-field">${PITCH_SVG}${dots(h.hs, false)}${dots(h.as, true)}</div></div>`;
  /* 控え：ホームとアウェイを左右に並べる（途中出場→ベンチの順） */
  const subEv = l => m.ev.find(e => e.kind === "交代" && e.side === l.side && same(e.player, l.name));
  const row = l => { const used = l.role === "途中出場", e = used ? subEv(l) : null;
    const info = used ? `<small class="sb-io">${ICON.sub}${e && e.rel ? `<span>OUT ${esc(e.rel)}</span>` : "<span>途中出場</span>"}</small>` : `<small class="sb-io off">出場なし</small>`;
    const tag = used ? `<span class="sb-min">${e && e.min ? esc(String(e.min)).replace(/分$/, "") + "'" : l.s["出場時間"] != null ? l.s["出場時間"] + "分" : "IN"}</span>` : "";
    return link(l, `<span class="sb-ph">${face(l.name, "", l.no)}${l.no != null ? `<em>${l.no}</em>` : ""}</span><span class="sb-tx"><span class="sb-nm"><i>${esc((used ? playedPos(m, l) : l.pos) || "")}</i>${hurtIn(m, l) ? INJ_MARK : ""}${esc(l.name)}${gIcon(l)}</span>${info}</span>${tag}${rtChip(l.rating)}`, "sb" + (used ? "" : " off")); };
  const col = side => { const list = [...L(side).filter(l => l.role !== "先発"), ...B(side)].map((l, i) => [l, i]).sort((a, b) => (+b[0].s["出場時間"] || 0) - (+a[0].s["出場時間"] || 0) || a[1] - b[1]).map(x => x[0]);
    return `<div class="sb-col"><div class="sb-h">${logo(club(side), "sm")}<b>${esc(club(side))}</b><small>${list.length}名</small></div>${list.length ? list.map(row).join("") : `<div class="sb-none">記録なし</div>`}</div>`; };
  return `<div class="lu" data-t="${t0}">` + pitch + `<div class="sb-sec"><div class="sb-title">SUBSTITUTES<small>控え</small></div><div class="sb-cols">${col(h.hs)}${col(h.as)}</div></div></div>`;
}
