/* 選手・スタッフ一覧、選手ページ、スタッフページ */

const POSCAT = p => /GK/.test(p) ? "GK" : /(CB|LB|RB|WB|SW)/.test(p) ? "DF" : /(ST|CF|LW|RW|LF|RF|LS|RS)/.test(p) ? "FW" : p ? "MF" : "他";
function vSquad() {
  const s = ST.season, P = playerAgg(ofSeason(s)), byN = {}; P.forEach(p => byN[nameKey(p.name)] = p);
  let list = D.players.filter(p => !/退団/.test(p.status));
  if (!list.length) list = P.map(p => ({ name: p.name, pos: p.pos || "", status: "在籍" }));
  const loan = list.filter(onLoan); list = list.filter(p => !onLoan(p));
  const G = { GK: [], DF: [], MF: [], FW: [], 他: [] };
  list.forEach(p => G[POSCAT(p.pos)].push(p));
  const lbl = { GK: ["GK", "ゴールキーパー"], DF: ["DF", "ディフェンダー"], MF: ["MF", "ミッドフィルダー"], FW: ["FW", "フォワード"], 他: ["OTHERS", "その他"] };
  const card = (p, isLoan) => { const a = byN[nameKey(p.name)] || {}, lc = isLoan ? loanClub(p.name) : "", ls = isLoan ? D.loans.filter(x => same(x.name, p.name) && (!s || x.season === s)).pop() : null;
    return `<a class="pcard${isLoan ? " loan" : ""}" href="#/player/${pslug(p.name)}">
      <div class="ph-wrap">${p.no != null && !isLoan ? `<span class="no">${p.no}</span>` : ""}${isYouth(p) ? `<span class="acad">ACADEMY</span>` : ""}${!isLoan && injAt(p.name) ? `<span class="injb">${ICON_INJ}負傷中</span>` : ""}${face(p.name)}<span class="pos">${esc(p.pos || "")}</span></div>
      <div class="info"><b>${flag(p.nat)}${esc(p.name)}</b><small>${isLoan ? (lc ? `${esc(lc)}${leagueOf(lc) ? `（${esc(leagueOf(lc))}）` : ""}` : "期限付き移籍中") + (ls ? `<br>${ls.apps ?? 0}試合 ${ls.g ?? 0}得点 ${ls.a ?? 0}アシスト` : "")
        : a.apps ? (/GK/.test(p.pos || a.pos || "") ? `${a.apps}試合 クリーンシート${a.cs}` : `${a.apps}試合 ${a.g}得点 ${a.a}アシスト`) : "出場なし"}</small></div></a>`; };
  const out = D.players.filter(p => /退団/.test(p.status));
  const jl = [["GK", "GK"], ["DF", "DF"], ["MF", "MF"], ["FW", "FW"], ["他", "その他"]].filter(([k]) => G[k].length).map(([k, t]) => [`sq-${k}`, t]);
  if (loan.length) jl.push(["sq-loan", "期限付き"]);
  if (staffList().length) jl.push(["sq-staff", "スタッフ"]);
  const jump = jl.length > 1 ? `<nav class="sq-jump">${jl.map(([id, t]) => `<button type="button" data-id="${id}" onclick="sqJump('${id}')">${t}</button>`).join("")}</nav>` : "";
  return band("SQUAD", "選手・スタッフ", true) + jump + `<div class="wrap">
    ${["GK", "DF", "MF", "FW", "他"].filter(k => G[k].length).map(k => `<div id="sq-${k}" class="sq-anc"></div>` + sec(lbl[k][0], lbl[k][1]) + `<div class="pgrid">${G[k].sort((a, b) => (a.no ?? 999) - (b.no ?? 999)).map(p => card(p)).join("")}</div>`).join("") || `<div class="panel">${empty("選手情報はまだありません。")}</div>`}
    ${loan.length ? `<div id="sq-loan" class="sq-anc"></div>` + sec("ON LOAN", "期限付き移籍中の選手") + `<div class="pgrid">${loan.map(p => card(p, true)).join("")}</div>` : ""}
    <div id="sq-staff" class="sq-anc"></div>${staffBlock()}
    ${out.length ? `<div id="sq-out" class="sq-anc"></div>` + sec("FORMER PLAYERS", "過去に在籍した選手") + `<div class="panel">${out.map(p => `<a class="prow" href="#/player/${pslug(p.name)}"><span class="no"></span>${face(p.name)}<div class="nm"><b>${esc(p.name)}</b><small>${esc(p.pos)}</small></div></a>`).join("")}</div>` : ""}</div>`;
}

function sqJump(id) { const el = document.getElementById(id); if (!el) return; const top = document.querySelector(".top").offsetHeight + (document.querySelector(".sq-jump")?.offsetHeight || 0) + 8; window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - top, behavior: "smooth" }); }
function vPlayer(name) {
  const p = prof(name) || { name, pos: "" };
  const s = ST.season, Ls = ofSeason(s), all = playerAgg(D.played).find(x => same(x.name, name));
  const a = playerAgg(Ls).find(x => same(x.name, name));
  const G = D.growth.filter(g => same(g.name, name));
  const lastG = G[G.length - 1] || {};
  const lastV = [...G].reverse().find(g => g.value != null) || {};
  const ovr = p.ovr ?? lastG.ovr, pot = p.pot ?? lastG.pot, val = p.value ?? lastV.value;
  const hw = [p.height ? p.height + "cm" : "", p.weight ? p.weight + "kg" : ""].filter(Boolean).join(" / ");
  const info = [["生年月日", p.birth ? `${fmtD(p.birth)}（${age(p.birth)}歳）` : ""], ["出身地", p.pref], ["身長 / 体重", hw], ["利き足", p.foot]].filter(x => x[1]);
  const tiles = a ? [["出場", a.apps, "試合"], ["平均評価", a.rating != null ? fmtN(a.rating, 2) : "-"],
    ...(isGK(a, p) ? [["セーブ率", (r => r != null ? fmtN(r, 1) : "-")(saveRate(a)), "%"], ["クリーンシート", a.cs, "試合"]] : [["得点", a.g], ["アシスト", a.a]])] : [];
  const statCats = a ? pStatCats(a, p) : [];
  const ratings = a ? a.list.filter(x => x.l.rating != null).map(x => ({ m: x.m, r: x.l.rating })) : [];
  const ovrChart = G.length >= 2 ? lineChart([
    { name: "総合値", color: "#2E86C8", pts: G.filter(g => g.ovr != null && g.date).map(g => ({ x: g.date, v: g.ovr, tip: `<b>${fmtD(g.date)}</b><br>総合値 ${g.ovr}${g.pot ? ` / ポテンシャル ${g.pot}` : ""}${g.value ? `<br>市場価値 ${money(g.value)}` : ""}` })) },
    { name: "ポテンシャル", color: "#D9702A", dash: true, pts: G.filter(g => g.pot != null && g.date).map(g => ({ x: g.date, v: g.pot, tip: `<b>${fmtD(g.date)}</b><br>ポテンシャル ${g.pot}` })) }
  ], { label: "総合値とポテンシャルの推移" }) : "";
  const GV = G.filter(g => g.value != null && g.date);
  const valChart = GV.length >= 2 ? lineChart([{ name: "市場価値", color: "#2E86C8", pts: GV.map(g => ({ x: g.date, v: g.value, tip: `<b>${fmtD(g.date)}</b><br>市場価値 ${money(g.value)}` })) }], { label: "市場価値の推移", fmt: money }) : "";
  const bySeason = D.seasonList.map(se => ({ se, x: playerAgg(ofSeason(se)).find(q => same(q.name, name)) })).filter(o => o.x);
  const matches = a ? [...a.list].reverse() : [];
  const tr = D.trans.filter(t => same(t.name, name));
  return `<section class="phero"><div class="phero-in"><div>
      ${p.no != null ? `<div class="bigno">${p.no}</div>` : ""}<h1>${esc(name)}</h1>${p.roma ? `<p class="roma">${esc(p.roma)}</p>` : ""}<div class="pos">${flag(p.nat)}${esc(p.pos || "")}${onLoan(p) ? `<span class="ph-st">期限付き移籍中</span>` : /退団/.test(p.status || "") ? `<span class="ph-st">退団</span>` : ""}</div>${(ij => ij ? `<div class="inj-st">${ICON_INJ}負傷離脱中${ij.what ? `（${esc(ij.what)}）` : ""}${ij.back ? `<small>${md(ij.back)}ごろ復帰予定</small>` : ""}</div>` : "")(injAt(name))}
      ${isYouth(p) ? `<span class="acad-tag">ACADEMY</span>` : ""}
    </div><div class="photo">${face(name)}</div></div></section>
  <div class="wrap">
    ${info.length ? sec("PROFILE", "プロフィール") + `<div class="prof p4" style="--n:${info.length}">${info.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
    ${p.memo ? `<p style="color:var(--tx2);margin:12px 0 0">${esc(p.memo)}</p>` : ""}
    ${playerFirsts(all)}${playerTitles(p, name, bySeason)}${playerHistory(p, name, bySeason)}
    <h2 class="sec"><b>SEASON STATS</b><small>シーズン成績</small><span style="margin-left:auto">${seasonSel()}</span></h2>
    ${tiles.length ? `<div class="tiles t4">${tiles.map(([k, v, u]) => `<div class="tile"><span>${k}</span><b>${typeof v === "number" ? fmtN(v) : esc(v)}${u ? `<small>${u}</small>` : ""}</b></div>`).join("")}</div>
      ${statCats.length ? `<div class="pst">${statCats.map(([t, en, rows]) => `<div class="pst-c"><h3><b>${en}</b>${t}</h3>${rows.map(r => r.bar != null
        ? `<div class="pst-r rate"><span>${r.k}</span><em>${r.sub || ""}</em><b>${fmtN(r.bar, 1)}<small>%</small></b><i style="--pw:${Math.min(100, r.bar)}%"></i></div>`
        : `<div class="pst-r"><span>${r.k}</span><em>${r.sub || ""}</em><b>${r.v}${r.u ? `<small>${r.u}</small>` : ""}</b></div>`).join("")}</div>`).join("")}</div>` : ""}` : `<div class="panel">${empty("このシーズンの出場はありません。")}</div>`}
    ${ratings.length ? sec("RATING", "試合ごとの評価") + `<div class="chart">${ratingChart(ratings.slice(-30))}</div>` : ""}
    ${ovrChart ? sec("GROWTH", "能力値の推移") + `<div class="chart">${ovrChart}</div>` : ""}
    ${valChart ? sec("MARKET VALUE", "市場価値の推移") + `<div class="chart">${valChart}</div>` : ""}
    ${matches.length ? sec("MATCHES", "出場試合") + `<div class="panel">
      ${matches.map(({ m, l }, i) => { const st = [l.s["出場時間"] != null ? `${l.s["出場時間"]}分` : l.role !== "先発" ? "途中出場" : "", l.s["得点"] ? `${l.s["得点"]}得点` : "", l.s["アシスト"] ? `${l.s["アシスト"]}アシスト` : ""].filter(Boolean);
        return `<a class="pmr${i >= 5 ? " more" : ""}" href="#/match/${m.id}"><div class="pmr-d"><b>${dotD(m.date)}</b>${roundBr(m)}</div>
        <div class="pmr-m">${logo(m.opp, "md")}<div><b class="pmr-o">${esc(m.opp)}</b><span class="pmr-s"><span class="res ${m.res}">${m.gf}-${m.ga}</span>${m.pk ? `<small>PK ${m.pk.a}-${m.pk.b}</small>` : ""}</span><span class="pmr-r">${rt(l.rating)}</span>
        <small class="pmr-x"><i>${esc(playedPos(m, l) || "")}</i>${st.map(x => `<span>${x}</span>`).join("")}</small></div></div></a>`; }).join("")}${matches.length > 5 ? `<button type="button" class="pm-more" onclick="const c=this.parentNode;c.classList.toggle('open');this.textContent=c.classList.contains('open')?'閉じる':'すべて見る（${matches.length}試合）'">すべて見る（${matches.length}試合）</button>` : ""}</div>` : ""}
    ${bySeason.length ? sec("CAREER", "シーズン別成績") + `<div class="tw"><table class="t"><thead><tr><th class="l" style="padding-left:16px">シーズン</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th><th>MOM</th></tr></thead><tbody>
      ${bySeason.map(({ se, x }) => `<tr><td class="l" style="padding-left:16px">${esc(se)}</td><td>${x.apps}</td><td>${x.g}</td><td>${x.a}</td><td>${rt(x.rating)}</td><td>${x.mom}</td></tr>`).join("")}
      ${all && bySeason.length > 1 ? `<tr class="me"><td class="l" style="padding-left:16px">通算</td><td>${all.apps}</td><td>${all.g}</td><td>${all.a}</td><td>${rt(all.rating)}</td><td>${all.mom}</td></tr>` : ""}</tbody></table></div>` : ""}
    ${(() => { const LL = D.loans.filter(x => same(x.name, name)); if (!LL.length) return "";
      return sec("LOAN", "期限付き移籍先での成績") + `<div class="tw"><table class="t lt"><thead><tr><th class="l" style="padding-left:16px">シーズン</th><th class="l">クラブ</th><th>出場</th><th>得点</th><th>アシスト</th><th class="mh">平均評価</th><th class="mh">更新日</th></tr></thead><tbody>
        ${LL.map(x => `<tr><td class="l" style="padding-left:16px">${esc(x.season)}</td><td class="club l"><div>${logo(x.club, "sm")}<span>${esc(x.club)}${leagueOf(x.club) ? `<small style="display:block;color:var(--tx3);font-weight:500;font-size:11px">${esc(leagueOf(x.club))}</small>` : ""}</span></div></td>
          <td>${x.apps ?? ""}</td><td>${x.g ?? ""}</td><td>${x.a ?? ""}</td><td class="mh">${rt(x.rating)}</td><td class="mh">${dotY(x.date)}</td></tr>`).join("")}</tbody></table></div>`; })()}
    ${tr.length ? sec("TRANSFER", "移籍歴") + `<div class="tblock">${tr.map(trRow).join("")}</div>` : ""}
    <p class="back"><a class="btn" href="#/squad">PLAYERS</a></p></div>`;
}

/* GK判定・失点・セーブ率（失点が未入力なら出場したGK試合の失点で補う） */
const isGK = (a, p) => /GK/.test(a.pos || p.pos || "") || (a.has["セーブ"] && a.s["セーブ"] > 0);
const gkGA = a => a.has["失点"] ? a.s["失点"] || 0 : a.list.some(x => /GK/.test(x.l.pos || "")) ? sum(a.list.filter(x => /GK/.test(x.l.pos || "")), x => x.m.ga || 0) : null;
function saveRate(a) { const sv = a.has["セーブ"] ? a.s["セーブ"] || 0 : null, ga = gkGA(a); return sv == null || ga == null || sv + ga === 0 ? null : sv / (sv + ga) * 100; }
/* 選手ページのシーズン成績（カテゴリー別） */
function pStatCats(a, p) {
  const S = k => a.has[k] ? a.s[k] ?? 0 : null, min = a.min || 0;
  const p90 = v => v && min >= 90 ? `${fmtN(v / min * 90, 2)} / 90分` : "";
  const n = (k, v, o = {}) => v == null ? null : { k, v: typeof v === "number" ? fmtN(v, o.d ?? 0) : v, u: o.u || "", sub: o.sub ?? "" };
  const rate = (k, x, y, lbl) => x == null || !y ? null : { k, bar: x / y * 100, sub: `${fmtN(x)} / ${fmtN(y)}${lbl ? ` ${lbl}` : ""}` };
  const gk = isGK(a, p);
  const sh = S("シュート"), on = S("枠内シュート"), xg = S("ゴール期待値"), ps = S("パス"), pok = S("パス成功"), dr = S("ドリブル"), dok = S("ドリブル成功"), tk = S("タックル"), tok = S("タックル成功");
  const sub = a.apps - a.starts, dist = S("走行距離");
  const C = [
    ["出場", "APPEARANCES", [n("出場時間", a.has["出場時間"] ? min : null, { u: "分", sub: a.apps ? `${fmtN(min / a.apps, 0)}分 / 試合` : "" }), n("先発", a.starts, { u: "試合" }), n("途中出場", sub, { u: "試合" }), n("MOM", a.mom, { u: "回" })]],
    ["攻撃", "ATTACK", [n("得点", a.g, { sub: p90(a.g) }), n("ゴール期待値", xg, { d: 2, sub: xg != null ? `得点との差 ${a.g - xg >= 0 ? "+" : ""}${fmtN(a.g - xg, 2)}` : "" }), n("シュート", sh, { sub: p90(sh) }), n("枠内シュート", on),
      rate("枠内率", on, sh), rate("決定率", sh ? a.g : null, sh, "")]],
    ["パス", "PASSING", [n("アシスト", a.a, { sub: p90(a.a) }), n("キーパス", S("キーパス"), { sub: p90(S("キーパス")) }), n("パス", ps, { sub: p90(ps) }), rate("パス成功率", pok != null && ps && pok <= ps ? pok : null, ps)]],
    ["ドリブル", "DRIBBLING", [n("ドリブル", dr), n("ドリブル成功", dok, { sub: p90(dok) }), rate("ドリブル成功率", dok != null && dr && dok <= dr ? dok : null, dr)]],
    ["守備", "DEFENDING", [n("タックル", tk), n("タックル成功", tok, { sub: p90(tok) }), rate("タックル成功率", tok != null && tk && tok <= tk ? tok : null, tk), n("インターセプト", S("インターセプト"), { sub: p90(S("インターセプト")) }), n("ブロック", S("ブロック")), n("クリア", S("クリア"))]],
    gk ? ["ゴールキーパー", "GOALKEEPING", [n("セーブ", S("セーブ"), { sub: p90(S("セーブ")) }), (r => r == null ? null : { k: "セーブ率", bar: r, sub: `${fmtN(S("セーブ"))} / ${fmtN(S("セーブ") + gkGA(a))}` })(saveRate(a)), n("失点", gkGA(a), { sub: p90(gkGA(a)) }), n("クリーンシート", a.cs, { u: "試合" })]] : null,
    ["その他", "OTHERS", [n("走行距離", dist, { d: 1, u: "km", sub: dist != null && a.apps ? `${fmtN(dist / a.apps, 1)}km / 試合` : "" }), n("警告", a.yc), n("退場", a.rc)]]
  ];
  if (gk) C.splice(1, 0, C.splice(5, 1)[0]);
  return C.filter(Boolean).map(([t, en, rows]) => [t, en, rows.filter(Boolean)]).filter(c => c[2].length);
}

/* このチームでの初出場・初得点・初アシスト */
function playerFirsts(all) {
  if (!all) return "";
  const L = [...all.list].sort((x, y) => (x.m.date || 0) - (y.m.date || 0)), k = nameKey(all.name);
  const g = o => o.l.s["得点"] || (o.m._sc && o.m._sc[k]) || 0, as = o => o.l.s["アシスト"] || (o.m._as && o.m._as[k]) || 0;
  const F3 = [["初出場", L[0]], ["初得点", L.find(o => g(o) > 0)], ["初アシスト", L.find(o => as(o) > 0)]];
  return sec("FIRSTS", `${clubName()}での初記録`) + `<div class="firsts">${F3.map(([t, o]) => o
    ? `<a href="#/match/${o.m.id}"><span>${t}</span><b>${fmtD(o.m.date)}</b><small>${roundBr(o.m)}</small><small>vs ${esc(o.m.opp)}</small><small class="fs-sc">${o.m.gf}-${o.m.ga}${o.m.pk ? `（PK ${o.m.pk.a}-${o.m.pk.b}）` : ""}</small></a>`
    : `<div class="none"><span>${t}</span><b>-</b><small>まだ記録はありません</small></div>`).join("")}</div>`;
}
/* 在籍していたシーズン */
function memberSeasons(p, name, bySeason) {
  const S = new Set(bySeason.map(o => o.se));
  const outs = D.trans.filter(t => same(t.name, name) && t.kind === "退団").map(t => t.season).filter(Boolean).sort();
  const end = /退団/.test(p.status || "") && outs.length ? outs[outs.length - 1] : null;
  const promoted = D.trans.some(t => same(t.name, name) && t.kind === "ユース昇格"), sf = !promoted && seniorFrom(p);
  const from = [p.joined, sf].filter(Boolean).sort()[0];
  if (from) D.seasons.forEach(x => { if (x.season >= from && (!end || x.season <= end)) S.add(x.season); });
  return S;
}

function playerTitles(p, name, bySeason) {
  const S = memberSeasons(p, name, bySeason), team = {}, ind = {};
  D.seasons.filter(x => S.has(x.season)).forEach(x => String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean).forEach(t => (team[t] = team[t] || []).push(x.season)));
  (D.awards || []).filter(a => same(a.name, name)).forEach(a => { const t = (a.comp ? a.comp + "\u0001" : "") + a.title; (ind[t] = ind[t] || []).push((a.season || "") + (a.month ? `（${/月$/.test(a.month) ? a.month : a.month + "月"}）` : "")); });
  const box = (o, empTxt) => Object.keys(o).length ? `<div class="trophies">${Object.keys(o).map(t => `<div class="trophy">${ICON.cup}${t.includes("\u0001") ? `<span class="tr-comp">${esc(t.split("\u0001")[0])}</span>` : ""}<b>${esc(t.split("\u0001").pop())}</b><small>${o[t].sort().map(esc).join("、")}</small><span class="cnt">${o[t].length}</span></div>`).join("")}</div>` : `<div class="panel">${empty(empTxt)}</div>`;
  return sec("TITLES", "個人タイトル") + box(ind, "まだ個人タイトルはありません。");
}
/* チーム歴 */
function playerHistory(p, name, bySeason) {
  const R = historyRows(p, name, bySeason);
  if (!R.length) return "";
  return sec("HISTORY", "チーム歴") + `<ol class="hist">${R.map(r => `<li><span>${esc(r.p)}</span>${r.school ? `<i class="hist-dot"></i>` : logo(r.lg || r.c, "sm")}<b>${esc(r.c)}${leagueOf(r.c) ? `<small>${esc(leagueOf(r.c))}</small>` : ""}</b>${r.note ? `<em${r.school ? ' class="sc"' : ""}>${esc(r.note)}</em>` : ""}</li>`).join("")}</ol>`;
}
const seasonOfYear = y => `${y}-${String(y + 1).slice(2)}`;
const proYear = () => parseInt(D.conf["最初のシーズン"], 10) || null;
/* 生え抜きの初期メンバーが、トップチーム（アマチュア含む）に上がった年 */
function seniorFrom(p) {
  if (!p || !p.birth || !(p.schools || []).some(x => x[0] === "高校" && isOwn(x[1]))) return null;
  const y0 = p.birth.getFullYear() + ((p.birth.getMonth() < 3 || (p.birth.getMonth() === 3 && p.birth.getDate() === 1)) ? 0 : 1);
  const jY = parseInt(p.joined, 10) || 9999;
  return seasonOfYear(Math.min(y0 + 18, jY));
}
function historyRows(p, name, bySeason) {
  const me = clubName(), R = [], yr = v => { const n = parseInt(v, 10); return n ? String(n) : (v || ""); };
  const T = D.trans.filter(t => same(t.name, name)).sort((a, b) => (a.date || 0) - (b.date || 0) || String(a.season).localeCompare(String(b.season)));
  const promo = T.find(t => t.kind === "ユース昇格");
  /* 小学・中学・高校（年は生年月日から。早生まれは1年早く入学） */
  const y0 = p.birth ? p.birth.getFullYear() + ((p.birth.getMonth() < 3 || (p.birth.getMonth() === 3 && p.birth.getDate() === 1)) ? 0 : 1) : null;
  const pY = promo ? parseInt(promo.season, 10) : null, jY = parseInt(p.joined, 10) || null;
  /* トップチームに上がった年：昇格の記録 → なければU-18卒業の年（加入年より遅ければ加入年） */
  const ownU18 = (p.schools || []).some(x => x[0] === "高校" && isOwn(x[1]));
  const topY = pY || (ownU18 && y0 ? Math.min(y0 + 18, jY || 9999) : null);
  (p.schools || []).forEach(([lb, v, a, n]) => { if (v) { const own = isOwn(v), end = y0 ? (lb === "高校" && own && topY ? topY : y0 + a + n) : null;
    R.push({ p: y0 ? `${y0 + a}〜${end}` : lb, c: v, lg: own ? (v.includes(me) ? me : oldName()) : "", note: own ? "" : lb, school: !own, own }); } });
  if ((/ユース/.test(p.origin || "") || promo) && !(p.schools || []).some(x => x[0] === "高校" && x[1])) R.push({ p: `${y0 ? y0 + 15 : ""}〜${yr(promo ? promo.season : p.joined)}`, c: me + " ユース", lg: me, note: "" });
  let cur = { p0: topY ? String(topY) : yr(p.joined || (bySeason.length ? bySeason[bySeason.length - 1].se : "")), c: me, note: "" };
  /* クラブ名変更前からトップチームにいた選手は、旧クラブ名の期間を分ける */
  const rnY = oldName() && renameDate() ? renameDate().getFullYear() : null;
  if (rnY && topY && topY < rnY) { R.push({ p: `${topY}〜${rnY}`, c: oldName(), lg: oldName(), note: "", own: true }); cur.p0 = String(rnY); }
  const close = (to) => { if (cur) { R.push({ p: `${cur.p0}〜${yr(to)}`, c: cur.c, note: cur.note }); cur = null; } };
  T.forEach(t => {
    if (t.kind === "レンタル移籍" && t.club) { close(t.season); cur = { p0: yr(t.season), c: t.club, note: "期限付き移籍" }; }
    else if (t.kind === "レンタル復帰") { close(t.season); cur = { p0: yr(t.season), c: me, note: "" }; }
    else if (t.kind === "退団") { close(t.season); if (t.club) cur = { p0: yr(t.season), c: t.club, note: "完全移籍" }; }
  });
  D.loans.filter(x => same(x.name, name) && x.club && !T.some(t => t.kind === "レンタル移籍" && same(t.club, x.club)))
    .forEach(x => { if (!R.concat(cur ? [{ c: cur.c }] : []).some(r => same(r.c, x.club))) R.push({ p: yr(x.season), c: x.club, note: "期限付き移籍" }); });
  if (cur) R.push({ p: `${cur.p0}〜`, c: cur.c, note: cur.note });
  return R;
}

/* ---------- スタッフ詳細 ---------- */
function vStaff(name) {
  const p = D.staff.find(x => same(x.name, name)) || staffList().find(x => same(x.name, name)) || { name, role: "" };
  const hw = [p.height ? p.height + "cm" : "", p.weight ? p.weight + "kg" : ""].filter(Boolean).join(" / ");
  const info = [["生年月日", p.birth ? `${fmtD(p.birth)}（${age(p.birth)}歳）` : ""], ["出身地", p.pref], ["身長 / 体重", hw], ["就任", p.joined ? p.joined + "シーズン" : ""]].filter(x => x[1]);
  /* 在任中の成績（就任シーズン以降） */
  const from = p.joined || "", left = /退団/.test(p.status || "");
  const M = D.played.filter(m => !from || m.season >= from).sort((a, b) => (a.date || 0) - (b.date || 0));
  const w = M.filter(m => m.res === "W").length, d = M.filter(m => m.res === "D").length, l = M.filter(m => m.res === "L").length;
  const gf = M.reduce((a, m) => a + (m.gf || 0), 0), ga = M.reduce((a, m) => a + (m.ga || 0), 0);
  const seasons = [...new Set(M.map(m => m.season))].sort().reverse();
  const S = historySeasons().filter(o => !from || o.se >= from);
  const titles = S.flatMap(o => o.titles.map(t => ({ se: o.se, t })));
  const showRec = p.role === "監督" || p.role === "ヘッドコーチ";
  return `<section class="phero"><div class="phero-in"><div>
      <div class="role-en">${esc(ROLE_EN[p.role] || "STAFF")}</div><h1>${esc(p.name)}</h1>${p.roma ? `<p class="roma">${esc(p.roma)}</p>` : ""}<div class="pos">${flag(p.nat)}${esc(p.role || "スタッフ")}${left ? "　退任" : ""}</div>
    </div><div class="photo">${face(p.name)}</div></div></section>
  <div class="wrap">
    ${info.length ? sec("PROFILE", "プロフィール") + `<div class="prof p4" style="--n:${info.length}">${info.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
    ${p.memo ? `<p style="color:var(--tx2);margin:12px 0 0">${esc(p.memo)}</p>` : ""}
    ${showRec ? sec("RECORD", "在任中の成績") + (M.length ? `<div class="tiles t4"><div class="tile"><span>試合</span><b>${M.length}</b></div>
      <div class="tile"><span>成績</span><b class="rec">${w}<small>勝</small>${d}<small>分</small>${l}<small>敗</small></b></div>
      <div class="tile"><span>勝率</span><b>${Math.round(w / M.length * 100)}<small>%</small></b></div>
      <div class="tile"><span>得点 / 失点</span><b>${gf}<small> / </small>${ga}</b></div></div>
      <div class="panel" style="margin-top:12px"><table class="t"><thead><tr><th>シーズン</th><th>リーグ</th><th>順位</th><th>試合</th><th>勝</th><th>分</th><th>敗</th></tr></thead><tbody>
      ${seasons.map(se => { const X = M.filter(m => m.season === se), o = S.find(z => z.se === se) || {};
        return `<tr><td>${esc(se)}</td><td>${esc(o.lg || "")}</td><td>${o.rank ? o.rank + "位" : "-"}</td><td>${X.length}</td><td>${X.filter(m => m.res === "W").length}</td><td>${X.filter(m => m.res === "D").length}</td><td>${X.filter(m => m.res === "L").length}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="panel">${empty("まだ試合はありません。")}</div>`) : ""}
    ${showRec ? sec("TITLES", "在任中のタイトル") + (titles.length ? `<div class="tb"><div class="tb-h"><div class="tl-ic">${ICON.cup}</div><div class="tb-n"><b>獲得タイトル</b><small>TITLES</small></div><div class="tl-c">${titles.length}<small>回</small></div></div>
      <ol class="tb-rows">${[...titles].reverse().map(x => `<li><span>${esc(x.se)}</span><b>${esc(x.t)}</b><em>${tier(x.t) ? tier(x.t) + "部" : "カップ"}</em></li>`).join("")}</ol></div>` : `<div class="panel">${empty("まだタイトルはありません。")}</div>`) : ""}
    ${playerHistory(p, p.name, [])}
    <p style="margin-top:28px"><a class="btn" href="#/squad">選手・スタッフ一覧</a></p>
  </div>`;
}
