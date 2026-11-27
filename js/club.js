/* ヒストリー・移籍情報・クラブ */

/* ---------- ヒストリー（シーズンごとの歩みとタイトル） ---------- */
function historySeasons() {
  const first = D.conf["最初のシーズン"] || "";
  const se = [...new Set([...D.seasons.map(x => x.season), ...D.seasonList])].filter(Boolean).sort();
  return se.map(k => {
    const x = D.seasons.find(y => y.season === k) || {}, lg = (k >= first && leagueOfSeason(k)) || x.league || "";
    const titles = String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean);
    const me = D.table.filter(r => r.season === k && isMe(r.club) && (!lg || r.comp === lg))[0];
    return { se: k, lg, t: tier(lg), titles, champ: titles.includes(lg), pro: first && k === first, efl: first && k >= first, rank: me && me.rank, cur: k === D.seasonList[0] && first && k >= first, memo: x.comment, fa: x.fa, cap: x.cap, vcap: x.vcap || [] };
  }).filter(o => o.lg);
}
/* タイトル：リーグ優勝はまとめて1枚、カップ戦は大会ごと */
function titleBoard(S, tc) {
  const lg = [], cups = {};
  S.forEach(o => o.titles.forEach(t => { if (tier(t)) lg.push({ se: o.se, t }); else (cups[t] = cups[t] || []).push(o.se); }));
  if (!lg.length && !Object.keys(cups).length) return `<div class="panel">${empty("まだタイトルはありません。")}</div>`;
  const head = (name, n, sub) => `<div class="tb-h"><div class="tl-ic">${ICON.cup}</div><div class="tb-n"><b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ""}</div><div class="tl-c">${n}<small>回</small></div></div>`;
  return `<div class="tboard">${lg.length ? `<div class="tb tb-lg">${head("リーグ優勝", lg.length, "LEAGUE CHAMPIONS")}
      <ol class="tb-rows">${[...lg].reverse().map(x => `<li><span>${esc(x.se)}</span><b>${esc(x.t)}</b><em>${tier(x.t)}部</em></li>`).join("")}</ol></div>` : ""}
    ${Object.keys(cups).length ? `<div class="tb-cups">${Object.keys(cups).sort((a, b) => cups[b].length - cups[a].length).map(t => `<div class="tb">${head(t, cups[t].length, "CUP")}
      <div class="tl-s">${cups[t].map(x => `<span>${esc(x)}</span>`).join("")}</div></div>`).join("")}</div>` : ""}</div>`;
}
/* シーズンごとのカップ戦・ヨーロッパの大会の成績（試合シートから自動）
   最後の試合で負け → 〇〇敗退／勝って次の試合が決まっている → 〇〇進出／決勝で勝ち → 優勝 */
const CUP_ORDER = ["FAカップ", "EFLカップ", "EFLトロフィー", "コミュニティ・シールド"];
const isEuro = c => /UEFA|ヨーロッパ|チャンピオンズ|カンファレンス/.test(c || "");
function compRuns(se) {
  const M = D.matches.filter(m => m.season === se && m.comp && !tier(m.comp) && !/節/.test(m.round || ""));
  const comps = [...new Set(M.map(m => m.comp))];
  return comps.map(c => {
    const L = M.filter(m => m.comp === c).sort((a, b) => a.date - b.date), P = L.filter(m => m.played), last = P[P.length - 1], next = L.find(m => !m.played);
    const won = m => m.res === "W" || (m.pk && m.pk.a > m.pk.b), fin = m => /決勝/.test(m.round || "") && !/準/.test(m.round || "");
    let txt, cls = "";
    if (!last) txt = next ? `${next.round || ""}から出場` : "";
    else if (fin(last) && won(last)) { txt = "優勝"; cls = "win"; }
    else if (next) txt = `${next.round || "次ラウンド"}進出`;
    else if (/グループ|リーグフェーズ|リーグステージ/.test(last.round || "")) txt = se === D.seasonList[0] ? `${last.round}` : `${last.round}敗退`;
    else if (!won(last)) txt = `${last.round || ""}敗退`;
    else txt = `${last.round || ""}突破`;
    return { comp: c, txt, cls, euro: isEuro(c), n: P.length, w: P.filter(won).length };
  }).filter(x => x.txt).sort((a, b) => (CUP_ORDER.indexOf(a.comp) + 1 || 99) - (CUP_ORDER.indexOf(b.comp) + 1 || 99));
}
function vHistory() {
  const S = historySeasons(), first = D.conf["最初のシーズン"] || "";
  if (!S.length) return band("HISTORY", "ヒストリー") + `<div class="wrap">${empty("シーズンシートにリーグを入れると、ここに歩みが表示されます。")}</div>`;
  const T = S.map(o => o.t).filter(Boolean), up = (() => { let n = 0, b = 0; S.forEach((o, i) => { if (i && o.t && S[i - 1].t && o.t < S[i - 1].t) { n++; b = Math.max(b, n); } else if (i) n = 0; }); return b; })();
  const tc = {}; S.forEach(o => o.titles.forEach(t => (tc[t] = tc[t] || []).push(o.se)));
  const nL = S.reduce((a, o) => a + o.titles.filter(t => tier(t)).length, 0), nC = S.reduce((a, o) => a + o.titles.filter(t => !tier(t)).length, 0);
  const res = o => o.champ ? `<span class="hx-r win">${ICON.cup}リーグ優勝</span>` : o.cur ? `<span class="hx-r now">シーズン中</span>` : o.rank ? `<span class="hx-r">${o.rank}位</span>` : "";
  const node = o => { const R = compRuns(o.se), got = new Set(R.map(x => x.comp));
    /* シートの「獲得タイトル」「FAカップ」にしかないもの（試合が入っていない大会）も出す */
    o.titles.filter(t => t !== o.lg && !got.has(t)).forEach(t => R.push({ comp: t, txt: "優勝", cls: "win", euro: isEuro(t) }));
    if (o.fa && !got.has("FAカップ")) R.push({ comp: "FAカップ", txt: esc(o.fa) + (/優勝|進出|敗退/.test(o.fa) ? "" : "進出"), cls: /優勝/.test(o.fa) ? "win" : "" });
    const line = x => `<span class="hx-run${x.cls ? " " + x.cls : ""}">${compLogo(x.comp, "hx-cl")}<b>${esc(x.comp)}</b><em>${x.cls === "win" ? ICON.cup : ""}${esc(x.txt)}</em></span>`;
    const cups = R.filter(x => !x.euro), eu = R.filter(x => x.euro);
    const rows = [cups.length ? ["カップ戦", cups.map(line).join("")] : null, eu.length ? ["ヨーロッパ", eu.map(line).join("")] : null,
      o.cap ? ["キャプテン", `<a href="#/player/${pslug(o.cap)}">${esc(o.cap)}</a>`] : null,
      o.vcap.length ? ["副キャプテン", o.vcap.map(n => `<a href="#/player/${pslug(n)}">${esc(n)}</a>`).join("")] : null].filter(Boolean);
    return `<li class="hx${o.champ ? " champ" : ""}${o.pro ? " pro" : ""}${o.cur ? " cur" : ""}">
      <div class="hx-se">${esc(String(o.se).replace(/^\d\d(\d\d-)/, "$1"))}</div><i class="hx-dot"></i>
      <div class="hx-card"><div class="hx-head"><b class="hx-t">${o.t || "-"}<small>部</small></b><div class="hx-lgw"><span class="hx-lg">${compLogo(o.lg, "hx-cl")}${esc(o.lg)}</span>${res(o)}</div></div>
        ${rows.length ? `<dl class="hx-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}
        ${o.memo ? `<p class="hx-memo">${esc(o.memo)}</p>` : ""}</div></li>`; };
  return band("HISTORY", "ヒストリー") + `<div class="wrap">
    <div class="tiles hx-sum hx-2"><div class="tile"><span>リーグ優勝</span><b>${nL}<small>回</small></b></div><div class="tile"><span>カップ戦優勝</span><b>${nC}<small>回</small></b></div></div>
    ${sec("ROAD TO PREMIER LEAGUE", "プレミアリーグへの道")}<ol class="hxl">${[...S].reverse().map(node).join("")}</ol>
    ${sec("TITLES", "獲得タイトル")}${titleBoard(S, tc)}
  </div>`;
}

const IN_KINDS = /^(加入|レンタル加入|レンタル復帰|ユース昇格)$/, OUT_KINDS = /^(退団|レンタル移籍)$/;
const KIND_TXT = { レンタル加入: "期限付き加入", レンタル移籍: "期限付き移籍", レンタル復帰: "復帰", ユース昇格: "昇格", 契約延長: "契約更新" };
/* 移籍時の年齢：生年月日があればその日付で計算、なければシートの値 */
function trAge(t) { const p = prof(t.name); return p && p.birth ? age(p.birth, t.date) : t.age; }
function trRow(t) {
  const cls = IN_KINDS.test(t.kind) ? "in" : OUT_KINDS.test(t.kind) ? "out" : "etc";
  const cl = t.club ? t.club + (leagueOf(t.club) ? `（${leagueOf(t.club)}）` : "") : "";
  const from = cls === "in" ? (cl ? `前所属：${cl}` : "") : cls === "out" ? (cl ? `${t.kind === "レンタル移籍" ? "期限付き移籍先" : "移籍先"}：${cl}` : "") : cl;
  return `<div class="trow"><a class="who" href="#/player/${pslug(t.name)}">${face(t.name)}<div><b><span class="kind ${cls}">${esc(KIND_TXT[t.kind] || t.kind)}</span>${esc(t.name)}</b>
    <small>${[t.pos, trAge(t) != null ? trAge(t) + "歳" : "", from, t.memo].filter(Boolean).map(esc).join("　")}</small></div></a>
    <div class="fee">${t.fee != null ? money(t.fee) : ""}<small>${dotY(t.date)}</small></div></div>`;
}
function vTransfers() {
  const s = ST.season, T = D.trans.filter(t => !s || t.season === s).sort((a, b) => (b.date || 0) - (a.date || 0));
  const ins = T.filter(t => IN_KINDS.test(t.kind)), outs = T.filter(t => OUT_KINDS.test(t.kind)), etc = T.filter(t => !IN_KINDS.test(t.kind) && !OUT_KINDS.test(t.kind));
  const spend = sum(ins, t => t.fee), income = sum(outs, t => t.fee);
  return band("TRANSFERS", "移籍情報", true) + `<div class="wrap narrow">
    ${T.length ? `<div class="tiles" style="margin-bottom:8px"><div class="tile"><span>獲得（${ins.length}人）</span><b>${money(spend) || "-"}</b></div>
      <div class="tile"><span>放出（${outs.length}人）</span><b>${money(income) || "-"}</b></div>
      <div class="tile"><span>収支</span><b>${spend || income ? (income - spend >= 0 ? "+" : "") + money(income - spend) : "-"}</b></div></div>` : ""}
    ${ins.length ? sec("IN", "加入") + `<div class="tblock">${ins.map(trRow).join("")}</div>` : ""}
    ${outs.length ? sec("OUT", "退団") + `<div class="tblock">${outs.map(trRow).join("")}</div>` : ""}
    ${etc.length ? sec("OTHERS", "その他") + `<div class="tblock">${etc.map(trRow).join("")}</div>` : ""}
    ${T.length ? "" : `<div class="panel">${empty("このシーズンの移籍はありません。")}</div>`}</div>`;
}

/* クラブの通算成績：全体・ホーム／アウェイ・大会別・対戦相手別・記録 */
function allTime(all, big) {
  const L = D.played;
  if (!all.n) return sec("ALL-TIME", "通算成績") + `<div class="panel">${empty("まだ試合がありません。")}</div>`;
  const pc = (a, b) => b ? fmtN(a / b * 100, 1) : "-", av = (a, b) => b ? fmtN(a / b, 2) : "-";
  const head = `<thead><tr><th class="l" style="padding-left:16px"></th><th>試合</th><th>勝</th><th>分</th><th>敗</th><th class="mh">得点</th><th class="mh">失点</th><th>得失差</th><th>勝率</th></tr></thead>`;
  const row = (lab, r) => `<tr><td class="l" style="padding-left:16px">${lab}</td><td>${r.n}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="mh">${r.gf}</td><td class="mh">${r.ga}</td><td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td>${pc(r.w, r.n)}%</td></tr>`;
  const tbl = rows => `<div class="tw"><table class="t at">${head}<tbody>${rows.join("")}</tbody></table></div>`;
  const H = L.filter(m => m.ha === "H"), A = L.filter(m => m.ha === "A"), N0 = L.filter(m => m.ha !== "H" && m.ha !== "A");
  const comps = [...new Set(L.map(m => m.comp))].map(c => [c, L.filter(m => m.comp === c)]).sort((a, b) => b[1].length - a[1].length);
  const opp = [...new Set(L.map(m => m.opp))].map(o => [o, L.filter(m => same(m.opp, o))]).sort((a, b) => b[1].length - a[1].length || record(b[1]).w - record(a[1]).w);
  /* 連続記録 */
  let w = 0, u = 0, c = 0, sc = 0, bw = 0, bu = 0, bc = 0, bs = 0;
  L.forEach(m => { w = m.res === "W" ? w + 1 : 0; u = m.res === "L" ? 0 : u + 1; c = m.ga === 0 ? c + 1 : 0; sc = m.gf > 0 ? sc + 1 : 0; bw = Math.max(bw, w); bu = Math.max(bu, u); bc = Math.max(bc, c); bs = Math.max(bs, sc); });
  const most = [...L].sort((a, b) => b.gf - a.gf || (b.gf - b.ga) - (a.gf - a.ga))[0];
  const pk = L.filter(m => m.pk), pkW = pk.filter(m => m.res === "W").length;
  const att = H.filter(m => m.att), topA = [...att].sort((a, b) => b.att - a.att)[0];
  const pos = L.map(m => tv(m, "me", "ボール支配率")).filter(v => v != null);
  const fm = {}; L.forEach(m => { const f = m.form && m.form.me; if (f) fm[f] = (fm[f] || 0) + 1; }); const fTop = Object.entries(fm).sort((a, b) => b[1] - a[1])[0];
  const tile = (k, v, e) => `<div class="tile"><span>${k}</span><b>${v}</b>${e ? `<em>${e}</em>` : ""}</div>`;
  const mLink = m => `<a href="#/match/${m.id}" style="color:inherit">${esc(m.opp)}　${dotY(m.date)}</a>`;
  return sec("ALL-TIME", "通算成績") + `<div class="tiles at-4">
      ${tile("試合", all.n)}${tile("成績", `${all.w}<small>勝</small>${all.d}<small>分</small>${all.l}<small>敗</small>`).replace("<b>", '<b class="rec">')}
      ${tile("勝率", `${pc(all.w, all.n)}<small>%</small>`)}${tile("勝点", all.pts, `1試合平均 ${av(all.pts, all.n)}`)}
      ${tile("得点", all.gf, `1試合平均 ${av(all.gf, all.n)}`)}${tile("失点", all.ga, `1試合平均 ${av(all.ga, all.n)}`)}
      ${tile("得失点差", `${all.gf - all.ga > 0 ? "+" : ""}${all.gf - all.ga}`)}${tile("クリーンシート", all.cs, `${pc(all.cs, all.n)}%の試合`)}</div>
    ${sec("HOME / AWAY", "ホーム・アウェイ別")}${tbl([H.length ? row("ホーム", record(H)) : "", A.length ? row("アウェイ", record(A)) : "", N0.length ? row("中立地", record(N0)) : ""])}
    ${sec("COMPETITIONS", "大会別")}${tbl(comps.map(([c, l]) => row(`<span class="at-c">${compLogo(c, "at-cl")}${esc(c)}</span>`, record(l))))}
    ${sec("TEAM RECORDS", "チーム記録")}<div class="tiles at-3">
      ${big ? tile("最多得点差勝利", `${big.gf}-${big.ga}`, mLink(big)) : ""}${most && most.gf ? tile("1試合最多得点", `${most.gf}<small>点</small>`, mLink(most)) : ""}
      ${tile("最多連勝", `${bw}<small>連勝</small>`)}${tile("最長無敗", `${bu}<small>試合</small>`)}${tile("最多連続無失点", `${bc}<small>試合</small>`)}${tile("最多連続得点", `${bs}<small>試合</small>`)}
      ${pk.length ? tile("PK戦", `${pkW}<small>勝</small>${pk.length - pkW}<small>敗</small>`) : ""}
      ${pos.length ? tile("平均ボール支配率", `${fmtN(pos.reduce((a, b) => a + b, 0) / pos.length, 1)}<small>%</small>`) : ""}
      ${att.length ? tile("ホーム平均観客数", `${fmtN(att.reduce((a, m) => a + m.att, 0) / att.length)}<small>人</small>`, topA ? `最多 ${fmtN(topA.att)}人（${esc(topA.opp)}戦）` : "") : ""}
      ${fTop ? tile("最多使用フォーメーション", esc(fTop[0]), `${fTop[1]}試合`) : ""}</div>
    ${sec("OPPONENTS", "対戦相手別")}${tbl(opp.map(([o, l]) => row(`<span class="at-c">${logo(o, "at-cl")}<span class="fn">${esc(o)}</span><span class="sn">${esc(shortOf(o))}</span></span>`, record(l))))}`;
}
function vClub() {
  const titles = [];
  D.seasons.forEach(x => String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean).forEach(t => titles.push({ t, s: x.season })));
  const tc = {}; titles.forEach(x => (tc[x.t] = tc[x.t] || []).push(x.s));
  const all = record(D.played), P = playerAgg(D.played);
  const big = D.played.filter(m => m.res === "W").sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const recs = [[PM[0], "通算得点"], [PM[1], "通算アシスト"], [PM[5], "通算出場"]].map(([M, l]) => rkCard(M, P, l)).filter(Boolean);
  const pol = Object.keys(D.conf).filter(k => /^方針\s*\d*$/.test(k)).sort((x, y) => (parseInt(x.replace(/\D/g, "")) || 0) - (parseInt(y.replace(/\D/g, "")) || 0)).map(k => D.conf[k]).filter(Boolean);
  const mgr = staffList().find(p => p.role === "監督"), founded = D.conf["創設年"], sl = D.conf["スローガン"];
  return band("CLUB", "クラブ") + `<section class="club-hero"><div class="club-hero-in">${logo(clubName(), "xl")}<div>
      <p class="kv-lab">${founded ? `EST. ${esc(founded)}` : "CLUB"}</p><h2>${esc(clubName())}</h2>
      ${sl ? `<p class="club-sl"><small>CLUB SLOGAN</small>${slogan(sl)}</p>` : ""}</div></div></section>
    ${identity()}<div class="wrap">
    ${pol.length ? sec("PHILOSOPHY", "クラブの方針") + `<ol class="policy">${pol.map((p, i) => `<li><b>${pad(i + 1)}</b><span>${esc(p)}</span></li>`).join("")}</ol>` : ""}
    ${mgr ? sec("MANAGER", "監督") + `<div class="mgr">${face(mgr.name)}<div><span>MANAGER</span><b><a href="#/staff/${pslug(mgr.name)}" style="color:inherit">${flag(mgr.nat)}${esc(mgr.name)}</a></b>${mgr.memo ? `<p>${esc(mgr.memo)}</p>` : ""}
      <a class="btn" href="#/staff/${pslug(mgr.name)}">PROFILE</a></div></div>` : ""}
    <a class="hist-link" href="#/history"><span><b>HISTORY</b><small>ヒストリー・獲得タイトル</small></span><em>${esc(clubName())}が歩んできた道のり</em><i>›</i></a>
    ${allTime(all, big)}
    ${recs.length ? sec("RECORDS", "通算記録") + `<div class="sgrid sgrid3">${recs.join("")}</div>` : ""}</div>`;
}
