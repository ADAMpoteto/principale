/* ニュース（記録・記事・画像の自動生成） */

/* ---------- ニュース（試合・移籍から自動で作る） ---------- */
const MON_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const NCAT = { CLUB: "チーム", CONTRACT: "契約更新", LOAN: "レンタル", TRANSFER: "移籍", PREVIEW: "試合情報", RESULT: "試合結果", ACADEMY: "トップ昇格", FIRST: "ユース記録", TEAMREC: "チーム記録", RECORD: "個人記録", AWARD: "個人賞", MEDICAL: "メディカル" };
/* 表示用のカテゴリー（n.cat は並び順などの判定用にそのまま使う） */
const ncat = n => n.cat === "MATCH" ? (n.kind === "result" ? "RESULT" : "PREVIEW")
  : n.cat === "TRANSFER" ? (n.tr && n.tr.kind === "契約延長" ? "CONTRACT" : n.tr && n.tr.kind === "ユース昇格" ? "ACADEMY" : n.tr && /レンタル/.test(n.tr.kind) ? "LOAN" : "TRANSFER")
  : n.cat === "RECORD" ? (n.ms && n.ms.firsts ? (isYouth(prof(n.ms.who) || { name: n.ms.who }) ? "FIRST" : "RECORD")
    : n.ms && /^(MOM|TOTW|MONTHLY MVP|AWARD)$/.test(n.ms.en || "") ? "AWARD"
    : n.ms && n.ms.club ? (/^(CHAMPIONS|PROMOTED|RELEGATED|SEASON REVIEW)$/.test(n.ms.en || "") ? "CLUB" : "TEAMREC") : "RECORD")
  : n.inj ? "MEDICAL" : "CLUB";
const catTag = n => `<span class="cat c-${ncat(n)}">${NCAT[ncat(n)]}</span>`;
const INJ_MARK = `<i class="injm" title="負傷"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/></svg></i>`;
/* 試合中に負傷した選手：試合経過の「負傷」か、負傷シートの日付が試合の日 */
const hurtIn = (m, l) => (m.ev || []).some(e => e.kind === "負傷" && e.side === l.side && same(e.player, l.name)) || (l.side !== "opp" && (D.inj || []).some(x => same(x.name, l.name) && m.date && dKey(x.date) === dKey(m.date)));
const ICON_INJ = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/></svg>`;
/* 負傷：その日に離脱中かどうか。「いま」は最後に記録がある日（試合・負傷の新しいほう） */
/* 復帰日が入っていれば、その日までは時間が進んでいる */
const gameNow = () => { const lp = D.played[D.played.length - 1], t = [lp ? +lp.date : 0, ...(D.inj || []).map(x => Math.max(+x.date, x.ret ? +x.ret : 0))]; return new Date(Math.max(...t) || Date.now()); };
const injAt = (name, d = gameNow()) => (D.inj || []).filter(x => same(x.name, name) && x.date <= d && d < (x.ret || x.back || new Date(8.64e15))).pop() || null;
const injTerm = x => x.n != null ? `約${x.n}${x.u === "日" ? "日" : x.u === "か月" ? "か月" : "週間"}` : "";
const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;
/* 記録達成（選手・チーム）。区切りの数字に届いた試合で1件 */
const MS_P = { g: { u: "ゴール", en: "GOALS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初ゴール", fe: "FIRST GOAL" }, a: { u: "アシスト", en: "ASSISTS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初アシスト", fe: "FIRST ASSIST" },
  apps: { u: "試合出場", en: "APPS", th: [1, 50, 100], step: 50, first: "トップチームデビュー", fe: "DEBUT" }, cs: { u: "クリーンシート", en: "CLEAN SHEETS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初クリーンシート", fe: "FIRST CLEAN SHEET" } };
/* クラブはプロ化（記録開始）以前から活動しているので「クラブ初〇〇」は出さない */
const MS_T = { w: { u: "勝利", en: "WINS", th: [50], step: 50 }, g: { u: "ゴール", en: "GOALS", th: [100], step: 100 },
  n: { u: "試合", en: "MATCHES", th: [100], step: 100 }, cs: { u: "クリーンシート", en: "CLEAN SHEETS", th: [25, 50], step: 50 } };
const hit = (def, before, after) => { const out = []; for (let v = before + 1; v <= after; v++) if (def.th.includes(v) || (v > def.th[def.th.length - 1] && v % def.step === 0)) out.push(v); return out; };
/* 記録の期間中にトップチームへ来た選手か（ユース昇格・加入）。それ以前からいる選手の「初〇〇」は本当の初ではない */
function newcomer(name) { return D.trans.some(t => same(t.name, name) && /ユース昇格|^加入|レンタル加入/.test(t.kind)); }
function milestones() {
  const N = [], P = {}, T = { w: 0, g: 0, n: 0, cs: 0 };
  D.played.forEach(m => {
    const add = {};
    const inc = (name, k, v) => { if (!name || /オウン/.test(name) || !v) return; const key = nameKey(name); (add[key] = add[key] || { name, g: 0, a: 0, apps: 0, cs: 0 })[k] += v; };
    m.scorers.forEach(x => inc(x.name, "g", x.n)); m.assists.forEach(x => inc(x.name, "a", x.n));
    m.lu.forEach(l => { inc(l.name, "apps", 1); if (/GK/.test(l.pos) && l.role === "先発" && m.ga === 0) inc(l.name, "cs", 1); });
    Object.values(add).forEach(x => { const p = P[nameKey(x.name)] || (P[nameKey(x.name)] = { g: 0, a: 0, apps: 0, cs: 0 });
      Object.keys(MS_P).forEach(k => { const nw = newcomer(x.name);
        hit(MS_P[k], p[k], p[k] + x[k]).filter(v => v > 1 || !MS_P[k].first).forEach(v => N.push({ id: `r-${k}-${nameKey(x.name)}-${v}`, d: m.date, cat: "RECORD", m0: m, ms: { who: x.name, k, v, def: MS_P[k], pro: !nw },
        t: `${x.name}選手 公式戦通算${v}${MS_P[k].u}達成` }));
        if (nw && MS_P[k].first && p[k] === 0 && x[k] > 0) (x.fs = x.fs || []).push(k); p[k] += x[k]; });
      /* 初記録（デビュー・初ゴールなど）：同じ試合でも1つずつ別の記事にする */
      if (x.fs) ["cs", "a", "g", "apps"].filter(k => x.fs.includes(k)).forEach(k => {
        const txt = `${x.name}選手が${MS_P[k].first}${k === "apps" ? "を果たしました" : "を記録しました"}。`;
        N.push({ id: `r-first-${k}-${nameKey(x.name)}-${m.id}`, d: m.date, cat: "RECORD", m0: m, ms: { who: x.name, k, v: 1, def: MS_P[k], firsts: [k], txt }, t: `${x.name}選手 ${MS_P[k].first}` }); }); });
    const tx = { w: m.res === "W" ? 1 : 0, g: m.gf, n: 1, cs: m.ga === 0 ? 1 : 0 };
    Object.keys(MS_T).forEach(k => { hit(MS_T[k], T[k], T[k] + tx[k]).forEach(v => N.push({ id: `r-t${k}-${v}`, d: m.date, cat: "RECORD", m0: m, ms: { club: true, k, v, def: MS_T[k], pro: true },
      t: `公式戦通算${v}${MS_T[k].u}達成` })); T[k] += tx[k]; });
  });
  return N.concat(milestones2(), milestones3());
}
/* リーグの格（イングランド。数字が小さいほど上） */
function tier(lg) { const s = String(lg || "");
  if (/カップ|トロフィー|ヴァーズ|シールド|杯/.test(s)) return null;
  const lv = s.match(/地区リーグ\s*(\d+)\s*部/); if (lv) return 14 + +lv[1];
  if (/ジンガリ/.test(s)) return 14;
  if (/LCPL|カウンティ/.test(s)) return /プレミア/.test(s) ? 11 : /2/.test(s) ? 13 : 12;
  if (/NWCFL/.test(s)) return /プレミア/.test(s) ? 9 : 10;
  if (/NPL|ノーザン/.test(s)) return /プレミア/.test(s) ? 7 : 8;
  if (/ナショナルリーグ/.test(s)) return /ノース|サウス/.test(s) ? 6 : 5;
  return /プレミア/.test(s) ? 1 : /チャンピオンシップ/.test(s) ? 2 : /リーグ\s*1$/.test(s) ? 3 : /リーグ\s*2$/.test(s) ? 4 : null; }
function leagueOfSeason(se) {
  const t = D.table.filter(r => r.season === se && isMe(r.club)).sort((a, b) => b.p - a.p)[0]; if (t) return t.comp;
  const s = D.seasons.find(x => x.season === se); if (s && s.league) return s.league;
  const c = {}; D.matches.filter(m => m.season === se && tier(m.comp)).forEach(m => c[m.comp] = (c[m.comp] || 0) + 1);
  const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; if (top) return top;
  /* まだリーグ戦がない今シーズンは、クラブシートの所属リーグ */
  return se === curSeason() || se === D.seasonList[0] ? clubInfo(clubName()).league || "" : "";
}
/* 最多得点差・連敗ストップ・1シーズンのクラブ記録・月間ベストプレーヤー・シーズン終了・昇格／優勝／降格 */
function milestones3() {
  const N = [], push = (m, id, t, ms, d) => N.push({ id, d: d || m.date, cat: "RECORD", m0: m, ms, t });
  let bigM = 0, lose = 0; const best = { g: 0, a: 0 }, cur = {}; let curSe = null;
  D.played.forEach(m => {
    /* 最多得点差の勝利（4点差以上でクラブ記録を更新） */
    const mg = m.gf - m.ga; if (m.res === "W" && mg >= 4 && bigM > 0 && mg > bigM) push(m, `r-big-${m.id}`, `クラブ史上最多得点差での勝利`, { club: true, big: `+${mg}`, en: "RECORD WIN", txt: `${clubName()}は${m.gf}-${m.ga}で勝利し、${clubName()}史上最多得点差（${mg}点差）の勝利を記録しました。` });
    if (m.res === "W") bigM = Math.max(bigM, mg);
    /* 連敗ストップ */
    if (m.res === "L") lose++; else { if (lose >= 4) push(m, `r-ls-${m.id}`, `連敗を${lose}でストップ`, { club: true, big: lose, en: "STREAK ENDED", txt: `${clubName()}は${m.res === "W" ? "勝利" : "引き分け"}で、連敗を${lose}で止めました。` }); lose = 0; }
    /* 1シーズンのクラブ記録（ゴール・アシスト）。過去のシーズンの記録を超えたとき1回だけ */
    if (m.season !== curSe) { Object.values(cur).forEach(p => { best.g = Math.max(best.g, p.g); best.a = Math.max(best.a, p.a); }); Object.keys(cur).forEach(k => delete cur[k]); curSe = m.season; }
    [["g", m.scorers, "ゴール"], ["a", m.assists, "アシスト"]].forEach(([k, L, u]) => L.forEach(x => { if (/オウン/.test(x.name)) return; const key = nameKey(x.name), p = cur[key] || (cur[key] = { g: 0, a: 0, done: {} });
      p[k] += x.n; if (best[k] > 0 && p[k] > best[k] && !p.done[k]) { p.done[k] = 1; push(m, `r-sr-${k}-${m.season}-${key}`, `${x.name}選手 クラブシーズン最多${u}記録を更新`, { who: x.name, big: p[k], en: k === "g" ? "GOALS" : "ASSISTS", txt: `${x.name}選手が今シーズン${p[k]}${u}目を記録し、クラブの1シーズン最多${u}記録（${best[k]}）を更新しました。` }); } }));
  });
  /* TOTW（チーム・オブ・ザ・ウィーク）選出。自チームの選手のみ、1試合で1記事、試合の5日後に発表 */
  const TW = {};
  D.played.forEach(m => { const L = m.lu.filter(l => l.totw); if (!L.length) return;
    const d = m.date, when = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）の${esc(roundTxt(m))} ${esc(m.opp)}戦`;
    const P = L.map(l => { const k = nameKey(l.name); TW[k] = (TW[k] || 0) + 1; return { name: l.name, pos: l.pos, rating: l.rating, ovr: l.rating != null ? Math.round(l.rating * 10) : null, c: TW[k], g: l.s["得点"] || 0, a: l.s["アシスト"] || 0 }; });
    const t = P.length === 1 ? `${P[0].name}選手 TOTW選出` : P.length === 2 ? `${P[0].name}選手・${P[1].name}選手 TOTW選出` : `TOTWに${P.length}選手が選出`;
    const li = P.map(x => `<li><span>${esc(x.pos || "")}</span><b><a href="#/player/${pslug(x.name)}">${esc(x.name)}</a></b></li>`).join("");
    push(m, `r-totw-${m.id}`, t, { who: P[0].name, en: "TOTW", totw: P,
      html: `<p>${when}での活躍が評価され、${P.length === 1 ? `${esc(P[0].name)}選手が` : `${P.length}選手が`}チーム・オブ・ザ・ウィーク（TOTW）に選ばれました。</p><ul class="srev">${li}</ul><p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH REPORT</a></p>` }, new Date(m.date.getFullYear(), m.date.getMonth(), m.date.getDate() + 5)); });
  /* 月間ベストプレーヤー（翌月の試合が入ったら） */
  const byM = {}; D.played.forEach(m => { if (m.date) (byM[`${m.date.getFullYear()}-${pad(m.date.getMonth() + 1)}`] = byM[`${m.date.getFullYear()}-${pad(m.date.getMonth() + 1)}`] || []).push(m); });
  const months = Object.keys(byM).sort();
  months.slice(0, -1).forEach(k => { const L = byM[k], R = {};
    L.forEach(m => m.lu.forEach(l => { if (l.rating == null) return; const r = R[nameKey(l.name)] || (R[nameKey(l.name)] = { name: l.name, s: 0, n: 0, g: 0, a: 0 }); r.s += l.rating; r.n++; r.g += l.s["得点"] || 0; r.a += l.s["アシスト"] || 0; }));
    const need = Math.max(1, Math.ceil(L.length / 2)), top = Object.values(R).filter(r => r.n >= need).sort((a, b) => b.s / b.n - a.s / a.n)[0]; if (!top) return;
    const last = L[L.length - 1], mo = parseInt(k.slice(5), 10);
    const st = [`公式戦${top.n}試合に出場`, top.g ? `${top.g}ゴール` : "", top.a ? `${top.a}アシスト` : ""].filter(Boolean).join("、");
    push(last, `r-mvp-${k}`, `${top.name}選手 ${mo}月度クラブ月間MVP受賞`, { who: top.name, en: "MONTHLY MVP", club_mvp: mo,
      html: `<p>${esc(clubName())}の${mo}月のクラブ月間MVPに、${esc(top.name)}選手が選ばれました。${mo}月は${st}しました。</p><p class="nbtn"><a class="btn" href="#/player/${pslug(top.name)}">PLAYER PROFILE</a></p>` }); });
  /* シーズン終了のまとめと、昇格／優勝／降格（次のシーズンの試合が入ったら） */
  const SS = [...new Set(D.matches.map(m => m.season).filter(Boolean))].sort();
  SS.forEach((se, i) => {
    const nx = SS[i + 1]; if (!nx) return;
    const L = ofSeason(se); if (!L.length) return;
    const last = L[L.length - 1], r = record(L), lg = leagueOfSeason(se), nlg = leagueOfSeason(nx);
    const me = D.table.find(t => t.season === se && t.comp === lg && isMe(t.club));
    const P = playerAgg(L), top = M => (ranked(P, M)[0] || {}).p, tg = top(PM[0]), ta = top(PM[1]), tr = top(PM[3]);
    const t1 = tier(lg), t2 = tier(nlg);
    const mv = t1 && t2 && t1 !== t2 ? (t2 < t1 ? "up" : "down") : "";
    if (me && me.rank === 1) push(last, `r-ch-${se}`, `${lg} 優勝のお知らせ`, { club: true, big: "", en: "CHAMPIONS", html: `<p>${esc(clubName())}は、${esc(se)}シーズンの${esc(lg)}で優勝しました！（${me.w}勝${me.d}分${me.l}敗・勝点${me.pts}）</p><p class="nbtn"><a class="btn" href="#/table">STANDINGS</a></p>` });
    if (mv) push(last, `r-mv-${se}`, mv === "up" ? `${nlg}への昇格が決定` : `${nlg}への降格が決定`, { club: true, big: "", en: mv === "up" ? "PROMOTED" : "RELEGATED",
      html: `<p>${esc(clubName())}は、${esc(se)}シーズンの${esc(lg)}を${me ? me.rank + "位" : ""}で終え、${esc(nx)}シーズンは${esc(nlg)}で戦うことが決まりました${mv === "up" ? "！" : "。"}</p><p class="nbtn"><a class="btn" href="#/table">STANDINGS</a></p>` });
    const li = (k, p, v) => p ? `<li><span>${k}</span><b>${esc(p.name)}</b>${v}</li>` : "";
    push(last, `r-ss-${se}`, `${se}シーズン 全日程終了のお知らせ`, { club: true, big: "", en: "SEASON REVIEW",
      html: `<p>${esc(clubName())}の${esc(se)}シーズンの全日程が終了しました。</p>
        <ul class="srev">${me ? `<li><span>${esc(lg)}</span><b>${me.rank}位</b>勝点${me.pts}</li>` : ""}<li><span>公式戦</span><b>${r.n}試合 ${r.w}勝${r.d}分${r.l}敗</b>得点${r.gf} 失点${r.ga}</li>
        ${li("チーム得点王", tg, `${ranked(P, PM[0])[0] ? ranked(P, PM[0])[0].v : ""}ゴール`)}${li("アシスト王", ta, `${ranked(P, PM[1])[0] ? ranked(P, PM[1])[0].v : ""}アシスト`)}${li("平均評価1位", tr, ranked(P, PM[3])[0] ? fmtN(ranked(P, PM[3])[0].v, 2) : "")}</ul>
        <p>今シーズンも応援ありがとうございました。</p><p class="nbtn"><a class="btn" href="#/stats">STATS</a></p>` }, last.date);
  });
  return N;
}
/* ハットトリック・連勝／無敗・クラブ最年少・MOM */
function ageTxt(birth, d) {
  let y = d.getFullYear() - birth.getFullYear(); const b = new Date(d.getFullYear(), birth.getMonth(), birth.getDate()); if (b > d) { y--; b.setFullYear(b.getFullYear() - 1); }
  return { y, days: Math.round((d - b) / 864e5), ms: d - birth };
}
function milestones2() {
  const N = [], mom = {}, rec = { win: 0, unb: 0 }, yng = { debut: null, goal: null }, seen = new Set();
  let win = 0, unb = 0;
  const push = (m, id, t, ms) => N.push({ id, d: m.date, cat: "RECORD", m0: m, ms, t });
  D.played.forEach((m, mi) => {
    /* ハットトリック */
    m.scorers.filter(x => x.n >= 3 && !/オウン/.test(x.name)).forEach(x => push(m, `r-ht-${m.id}-${nameKey(x.name)}`, `${x.name}選手 ${x.n === 3 ? "ハットトリック達成" : `1試合${x.n}ゴール`}`,
      { who: x.name, big: x.n, en: x.n === 3 ? "HAT-TRICK" : "GOALS", txt: `${x.name}選手が${x.n === 3 ? "ハットトリック" : `1試合${x.n}ゴール`}を達成しました。` }));
    /* 連勝・無敗 */
    win = m.res === "W" ? win + 1 : 0; unb = m.res === "L" ? 0 : unb + 1;
    const ws = [5, 7, 10, 15, 20].includes(win);
    if (ws) { const nr = win > rec.win && rec.win >= 3; push(m, `r-ws-${m.id}`, `公式戦${win}連勝${nr ? "（クラブ新記録）" : ""}`, { club: true, big: win, en: "WINS IN A ROW", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}${win}連勝を達成しました。` }); }
    if (!ws && unb >= 10 && unb % 5 === 0) { const nr = unb > rec.unb && rec.unb >= 10; push(m, `r-ub-${m.id}`, `公式戦${unb}試合無敗${nr ? "（クラブ新記録）" : ""}`, { club: true, big: unb, en: "UNBEATEN", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}公式戦${unb}試合無敗となりました。` }); }
    rec.win = Math.max(rec.win, win); rec.unb = Math.max(rec.unb, unb);
    /* クラブ最年少（デビュー・ゴール）。最初の記録は20歳以下のときだけ記事にする */
    /* 1試合につき、その試合で一番若い選手だけを比べる（同じ試合で記録が何度も更新されないように） */
    const chk = (kind, names) => { let best = null;
      names.forEach(name => { const p = prof(name); if (!p || !p.birth || !m.date) return; const a = ageTxt(p.birth, m.date); if (!best || a.ms < best.a.ms) best = { name, a }; });
      if (!best) return; const { name, a } = best, cur = yng[kind];
      if (!cur || a.ms < cur) { if (cur || a.y < 21) push(m, `r-yg-${kind}-${m.id}-${nameKey(name)}`, `${name}選手 クラブ史上最年少${kind === "debut" ? "デビュー" : "ゴール"}`,
        { who: name, big: a.y, en: "YEARS OLD", sub: `${a.y}歳${a.days}日`, txt: `${name}選手が${a.y}歳${a.days}日で${kind === "debut" ? "トップチームデビュー" : "ゴール"}を記録し、${clubName()}史上最年少記録を更新しました。` });
        yng[kind] = a.ms; } };
    const deb = [];
    m.lu.filter(l => l.role !== "ベンチ").forEach(l => { const k = nameKey(l.name); if (!seen.has(k)) { seen.add(k); if (newcomer(l.name)) deb.push(l.name); } });
    chk("debut", deb);
    chk("goal", m.scorers.filter(x => !/オウン/.test(x.name)).map(x => x.name));
    /* MOM */
    if (m.mom && !(m.momL && m.momL.side === "opp")) { const k = nameKey(m.mom), c = (mom[k] = (mom[k] || 0) + 1);
      if (c === 5 || (c >= 10 && c % 10 === 0)) { const pp = newcomer(m.mom) ? "" : clubName() + "での"; push(m, `r-mom-${k}-${c}`, `${m.mom}選手 通算${c}回目のMOM`, { who: m.mom, big: c, en: "MOM", txt: `${m.mom}選手が${pp}通算${c}回目のMOMに選ばれました。` }); } }
  });
  return N;
}
function buildNews() {
  const N = [];
  D.played.forEach(m => N.push({ id: "m" + m.id, d: m.date, cat: "MATCH", m, kind: "result", t: `${roundTitle(m)} vs ${m.opp}` }));
  const nx = D.matches.find(m => !m.played), lp = D.played[D.played.length - 1];
  /* 試合情報：試合が終わっても記事は残す。発表日は前の試合の日（最初の試合は試合の7日前） */
  const MS = [...D.matches].filter(m => m.date).sort((a, b) => a.date - b.date);
  MS.forEach((m, i) => { if (!m.played && m !== nx) return; const pv = MS[i - 1], d = pv ? pv.date : new Date(m.date.getFullYear(), m.date.getMonth(), m.date.getDate() - 7);
    N.push({ id: "n" + m.id, d, cat: "MATCH", m, kind: "info", top: m === nx ? 1 : 0, t: `${roundTitle(m)} vs ${m.opp}` }); });
  const TT = { 加入: n => `${n}選手 加入のお知らせ`, レンタル加入: n => `${n}選手 期限付き移籍加入のお知らせ`, レンタル復帰: n => `${n}選手 期限付き移籍からの復帰のお知らせ`,
    ユース昇格: n => `${n}選手 トップチーム昇格のお知らせ`, 契約延長: n => `${n}選手 契約更新のお知らせ`,
    退団: (n, c) => c ? `${n}選手 ${c}へ完全移籍のお知らせ` : `${n}選手 退団のお知らせ`, レンタル移籍: (n, c) => `${n}選手 ${c ? c + "へ" : ""}期限付き移籍のお知らせ` };
  const YO = D.trans.filter(t => t.kind === "ユース昇格").sort((x, y) => (x.date || 0) - (y.date || 0) || x.i - y.i);
  /* 昇格の記録がないアカデミー出身（初期メンバー）を先に数える */
  const Y0 = D.players.filter(p => !YO.some(t => same(t.name, p.name)) && seniorFrom(prof(p.name) || p) && (p.schools || []).some(x => x[0] === "高校" && x[1] && x[1].includes(clubName()))).length;
  D.trans.forEach(t => N.push({ id: "t" + t.i, d: t.date, cat: "TRANSFER", tr: t, yno: t.kind === "ユース昇格" ? Y0 + YO.indexOf(t) + 1 : 0, t: (TT[t.kind] || (n => `${n}選手 ${t.kind}のお知らせ`))(t.name, t.club) }));
  D.seasons.forEach(s => {
    const last = D.played.filter(m => m.season === s.season).pop();
    String(s.titles || "").split(/[、,，\/／]/).map(x => x.trim()).filter(Boolean).forEach((t, k) => N.push({ id: "c" + s.season + "-" + k, d: last && last.date, cat: "CLUB", title: t, season: s.season, top: 1, t: `${t} 優勝のお知らせ` }));
  });
  /* 個人タイトル（リーグの月間MVPなど）：発表日が入っている行をニュースに */
  (D.awards || []).forEach((a, i) => { if (!a.date) return; const mon = parseInt(String(a.month).replace(/\D/g, ""), 10), lg = a.comp || "", mo = mon ? `${mon}月の` : "";
    const monthly = /月間/.test(a.title);
    N.push({ id: "aw" + i, d: a.date, cat: "RECORD", ms: { who: a.name, en: monthly ? "MONTHLY MVP" : "AWARD", tag: [lg, mon && monthly ? MON_EN[mon - 1] : ""].filter(Boolean).join("　"),
      html: `<p>${esc(a.name)}選手が、${esc(lg)}${lg ? "の" : ""}${mo}${esc(a.title)}に選ばれました。${a.memo ? esc(a.memo) : ""}</p><p class="nbtn"><a class="btn" href="#/player/${pslug(a.name)}">PLAYER PROFILE</a></p>` },
      t: `${a.name}選手 ${lg ? lg + " " : ""}${mon ? `${mon}月度` : ""}${a.title}受賞のお知らせ` }); });
  /* 買収・クラブ名変更（最初のニュース） */
  if (oldName() && renameDate()) N.push({ id: "rename", d: renameDate(), cat: "CLUB", rename: true, t: `クラブ名変更のお知らせ` });
  (D.inj || []).forEach(x => N.push({ id: "i" + x.i, d: x.date, cat: "CLUB", inj: x, t: `${x.name}選手の負傷について` }));
  N.push(...milestones());
  return N.filter(n => n.d).sort((a, b) => b.d - a.d || (b.top || 0) - (a.top || 0) || (a.cat === "MATCH" ? -1 : 0));
}
/* サムネイル（画像の代わりに、試合ならエンブレムとスコア、移籍なら選手） */
function newsThumb(n) {
  /* 名字だけ：英字の名前は最後、日本語の名前は最初 */
  const surname = nm => { const w = String(nm).trim().split(/[\s　]+/); return w.length < 2 ? w[0] : /[A-Za-z]/.test(nm) ? w[w.length - 1] : w[0]; };
  if (n.ms && n.ms.totw) { const P = n.ms.totw, k = P.length;
    const card = x => { const pr = prof(x.name) || {}, nm = pr.roma || x.name;
      return `<div class="tw-card"><div class="tw-in"><span class="tw-lb">TOTW</span><div class="tw-o"><b>${x.ovr ?? ""}</b><small>${esc(x.pos || "")}</small>${logo(clubName(), "tw-cl")}</div>${face(x.name, "tw-f")}
        <div class="tw-n">${esc(surname(nm))}</div><div class="tw-ft">TEAM OF THE WEEK</div></div></div>`; };
    return `<div class="nt nt-totw${k > 1 ? " multi" : ""}" style="--n:${k}"><div class="tw-l"><b>TEAM OF${k > 1 ? " " : "<br>"}THE WEEK</b></div><div class="tw-cards">${P.map(card).join("")}</div></div>`; }
  /* 選手・チームの画像はすべて同じ型：見出し（英字1行）＋名前＋補足。色だけカテゴリーで変える */
  const nm2 = name => { const pr = prof(name) || {}; return `<span class="nv-nm"><span class="nv-n">${esc(pr.roma || name)}</span>${pr.roma ? `<span class="nv-j">${esc(name)}</span>` : ""}</span>`; };
  const clubLine = (pre, c) => c ? `<span class="nv-x">${pre} ${logo(c, "")}${esc(c)}</span>` : "";
  const fit = t => Math.min(12.5, 100 / Math.max(4, t.length)).toFixed(2);
  const V = ({ ac, kick, head, who, crest, x }) => `<div class="nt nt-v ac-${ac}"><b class="nv-wm" aria-hidden="true">${esc(head)}<br>${esc(head)}<br>${esc(head)}</b><i class="nv-sl"></i><i class="nv-bar"></i>${crest ? `<div class="nv-crest">${logo(clubName(), "")}</div>` : face(who)}
    <div class="nv-t">${kick ? `<span class="nv-k">${esc(kick)}</span>` : ""}<b class="nv-h" style="font-size:${fit(head)}cqw">${esc(head)}</b>${who && !crest ? nm2(who) : ""}${x || ""}</div></div>`;
  if (n.inj) { const x = n.inj;
    return V({ ac: "red", kick: "MEDICAL UPDATE", head: "INJURY", who: x.name }); }
  if (n.tr) { const t = n.tr;
    const c = { 契約延長: ["sky", "CONTRACT", "RENEWED"], ユース昇格: ["green", `ACADEMY${n.yno ? " #" + n.yno : ""}`, "PROMOTED"], 加入: ["blue", "NEW SIGNING", "WELCOME"], レンタル加入: ["blue", "LOAN SIGNING", "WELCOME"],
      レンタル移籍: ["blue", "LOAN", "ON LOAN"], レンタル復帰: ["blue", "BACK FROM LOAN", "WELCOME BACK"], 退団: ["gray", "FAREWELL", "THANK YOU"] }[t.kind] || ["blue", "NEWS", "NEWS"];
    const x = /^(加入|レンタル加入)$/.test(t.kind) ? clubLine("from", t.club) : /^(レンタル移籍|退団)$/.test(t.kind) ? clubLine("to", t.club) : "";
    return V({ ac: c[0], kick: c[1], head: c[2], who: t.name, x }); }
  if (n.ms) { const s = n.ms, m0 = n.m0, vs = m0 && m0.opp ? clubLine("vs", m0.opp) : "";
    if (s.firsts || (s.v === 1 && s.def && s.def.fe && !s.club)) return V({ ac: "green", kick: "MILESTONE", head: s.def.fe, who: s.who, x: vs });
    if (s.en === "MONTHLY MVP") { const mi = s.club_mvp ? s.club_mvp - 1 : MON_EN.findIndex(x => String(s.tag || "").includes(x)), lg = s.club_mvp ? "" : String(s.tag || "").split("　")[0];
      return V({ ac: "gold", kick: mi >= 0 ? MON_EN[mi] : "MONTHLY AWARD", head: s.club_mvp ? "CLUB MVP" : "PLAYER OF THE MONTH", who: s.who, x: lg ? `<span class="nv-x">${compLogo(lg, "nv-cl")}${esc(lg)}</span>` : "" }); }
    if (s.en === "AWARD") return V({ ac: "gold", kick: s.tag || "AWARD", head: "AWARD", who: s.who });
    if (s.club) { const rec = /クラブ新記録|最多得点差/.test(n.t || "");
      const num = s.big !== "" && s.big != null ? String(s.big) : s.v != null ? String(s.v) : "", unit = s.en || (s.def && s.def.en) || "";
      const head = s.en === "RECORD WIN" ? "RECORD WIN" : s.en === "UNBEATEN" ? `${num} GAMES UNBEATEN` : num ? `${num} ${unit}` : unit;
      return V({ ac: "gold", kick: rec ? "NEW CLUB RECORD" : s.en === "CHAMPIONS" || s.en === "PROMOTED" || s.en === "SEASON REVIEW" || s.en === "RELEGATED" ? String(n.m0 && n.m0.season || "") : "TEAM RECORD", head, crest: true, x: s.en === "RECORD WIN" && m0 ? `<span class="nv-x">${m0.gf}-${m0.ga}　vs ${logo(m0.opp, "")}${esc(m0.opp)}</span>` : vs }); }
    const big = s.big !== "" && s.big != null ? String(s.big) : "";
    if (s.en === "HAT-TRICK") return V({ ac: "gold", kick: "MATCH RECORD", head: "HAT-TRICK", who: s.who, x: vs });
    if (s.en === "YEARS OLD") { const deb = /デビュー/.test(n.t || ""); return V({ ac: "gold", kick: "CLUB RECORD", head: deb ? "YOUNGEST DEBUT" : "YOUNGEST SCORER", who: s.who, x: `<span class="nv-x">${esc(s.sub || "")}　vs ${logo(m0.opp, "")}${esc(m0.opp)}</span>` }); }
    if (s.en === "MOM") return V({ ac: "gold", kick: "PLAYER OF THE MATCH", head: `${big} MOM`, who: s.who, x: vs });
    const head = s.en ? (big ? `${big} ${s.en}` : s.en) : `${s.v} ${s.def.en}`;
    return V({ ac: "gold", kick: /シーズン最多/.test(n.t || "") ? "CLUB RECORD" : "MILESTONE", head, who: s.who, x: vs }); }
  if (n.m) { const h = homeAway(n.m);
    const res = n.kind === "result";
    return `<div class="nt nt-m2"><div class="nm-top">${compLogo(n.m.comp, "nm-cl")}${roundBr(n.m)}</div>
      <div class="nm-t">${logo(h.home, "")}<b>${esc(shortOf(h.home))}</b></div>
      <div class="nm-c"><div class="nm-s">${res ? scoreTxt(n.m) : "VS"}</div><small>${res ? "FULL TIME" : dotY(n.m.date)}</small></div>
      <div class="nm-t">${logo(h.away, "")}<b>${esc(shortOf(h.away))}</b></div></div>`; }
  if (n.rename) return `<div class="nt nt-rn"><div class="rn-c">${logo(oldName(), "")}<span>${esc(oldName())}</span></div><i class="rn-ar"></i><div class="rn-c">${logo(clubName(), "")}<span>${esc(clubName())}</span></div><b class="rn-h">NEW ERA</b></div>`;
  if (n.title) return V({ ac: "gold", kick: n.title, head: "CHAMPIONS", crest: true });
  return `<div class="nt nt-c2">${ICON.cup}<div class="nt-w">NEWS</div></div>`;
}
const newsCard = n => `<a class="ncard" href="#/news/${encodeURIComponent(n.id)}">${newsThumb(n)}<div class="nb"><div class="nmeta"><time>${dotY(n.d)}</time>${catTag(n)}</div><b>${esc(n.t)}</b></div></a>`;
const newsList = L => `<div class="news">${L.map(n => `<a href="#/news/${encodeURIComponent(n.id)}"><time>${dotY(n.d)}</time>${catTag(n)}<b>${esc(n.t)}</b></a>`).join("")}</div>`;
function newsBody(n) {
  /* 1文ごとに改行（\n で区切る） */
  const P = s => `<p>${String(s).split("\n").filter(Boolean).join("<br>")}</p>`;
  /* 表は必要な記事だけ。試合・選手へのリンクは他のページと同じ行の形 */
  const T = rows => { const R = rows.filter(r => r && r[1] !== "" && r[1] != null); return R.length ? `<dl class="inj-dl">${R.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""; };
  const dJ = d => d ? `${d.getFullYear()}年${md(d)}（${WD[d.getDay()]}）` : "";
  const prow = name => { const pr = prof(name) || {}; return `<a class="prow" href="#/player/${pslug(name)}"><span class="no">${pr.no ?? ""}</span>${face(name)}<div class="nm"><b>${esc(name)}</b><small>${esc(pr.pos || "")}</small></div></a>`; };
  const rel = (m, names = []) => { const N = names.filter(Boolean); return (m || N.length) ? `<div class="nrel">${m ? `<div class="ph">MATCH<small>試合</small></div><div class="mlist">${matchRow(m)}</div>` : ""}${N.length ? `<div class="ph">PLAYER<small>選手</small></div><div class="panel">${N.map(prow).join("")}</div>` : ""}</div>` : ""; };
  const when = m => `${md(m.date)}の${esc(m.opp)}戦`;
  if (n.ms && n.ms.totw) { const m = n.m0, L = n.ms.totw;
    return P(`${when(m)}での活躍が評価され、${L.map(x => `${esc(x.name)}選手`).join("、")}がTOTWに選ばれました！`) + rel(m, L.map(x => x.name)); }
  if (n.ms && n.ms.club_mvp) { const s = n.ms;
    return P(`${s.club_mvp}月度のクラブ月間MVPに、${esc(s.who)}選手が選ばれました！`) + rel(null, [s.who]); }
  if (n.ms && /^(AWARD|MONTHLY MVP)$/.test(n.ms.en || "") && !n.ms.totw) { const s = n.ms, aw = (D.awards || []).find(a => same(a.name, s.who) && a.date && dKey(a.date) === dKey(n.d)) || {};
    return P(`${esc(s.who)}選手が、${esc(aw.comp || "")}${aw.comp ? "の" : ""}${aw.month ? esc(aw.month) + "の" : ""}${esc(aw.title || "賞")}を受賞しました！`) + (aw.memo ? P(esc(aw.memo)) : "") + rel(null, [s.who]); }
  if (n.ms && n.ms.html) return n.ms.html;
  if (n.ms) { const s = n.ms, m = n.m0;
    if (s.club) { const what = s.txt ? esc(s.txt.replace(/^.+?は/, "")) : `公式戦通算${s.v}${s.def.u}を達成しました。`;
      return P(`${when(m)}で、${what.replace(/。$/, "！")}`) + rel(m); }
    const what = s.txt ? esc(s.txt.replace(/^.+?選手が/, "")) : `公式戦通算${s.v}${s.def.u}を達成しました。`;
    return P(`${when(m)}で、${esc(s.who)}選手が${what.replace(/。$/, "！")}`) + rel(m, [s.who]); }
  if (n.m && n.kind === "result") { const m = n.m;
    const v = { W: "勝利しました！", D: "引き分けました。", L: "敗れました。" }[m.res];
    return P(`${esc(roundTxt(m))}で${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk ? `（PK ${m.pk.a}-${m.pk.b}）` : ""}で${v}${m.mom ? `\nMOMは${esc(m.mom)}選手です。` : ""}`) + rel(m); }
  if (n.m) { const m = n.m, d = m.date;
    return P(`${esc(roundTxt(m))}、${esc(m.opp)}戦の試合情報です。`) + T([["大会", esc(roundTxt(m))], ["日時", `${dJ(d)}${kickoff(m) ? `<br>${kickoff(m)} キックオフ` : ""}`], ["会場", esc(venue(m) || "")]])
      + `<div class="art-pv">${headToHead(m)}</div>` + rel(m); }
  if (n.rename) { const d = n.d, st = D.conf["ホームスタジアム"];
    return P(`${esc(oldName())}は新たなオーナーグループによる買収にともない、クラブ名を「${esc(clubName())}」に変更しました。\nアカデミーとトップチームはそのまま引き継がれます。\n新しい${esc(clubName())}をよろしくお願いいたします。`)
      + T([["新クラブ名", esc(clubName())], ["旧クラブ名", esc(oldName())], ["変更日", dJ(d)], ["スタジアム", esc(st || "")]])
      + `<p class="nbtn"><a class="btn" href="#/club">CLUB</a></p>`; }
  if (n.inj) { const x = n.inj, m = D.played.find(q => dKey(q.date) === dKey(x.date)), d = x.date;
    const lead = m ? `${when(m)}で負傷した${esc(x.name)}選手の診断結果をお知らせします。` : `${esc(x.name)}選手の負傷についてお知らせします。`;
    return P(lead) + T([["負傷日", dJ(d)], ["診断名", esc(x.what || "")], ["全治", injTerm(x)], ["復帰予定", x.back ? dJ(x.back) : ""]]) + (x.memo ? P(esc(x.memo)) : "") + rel(m, [x.name]); }
  if (n.tr) { const t = n.tr, pr = prof(t.name) || {}, cl = t.club ? esc(t.club) + (leagueOf(t.club) ? `（${esc(leagueOf(t.club))}）` : "") : "";
    if (t.kind === "契約延長") return P(`${esc(t.name)}選手が契約を${t.years ? `${t.years}年` : ""}更新しました！`) + (t.memo ? P(esc(t.memo)) : "") + newsProfile(t, pr) + rel(null, [t.name]);
    if (t.kind === "ユース昇格") return P(`${esc(t.name)}選手がアカデミーからトップチームに昇格します！${n.yno ? `\nアカデミーから${n.yno}人目のトップ昇格です。` : ""}`) + (t.memo ? P(esc(t.memo)) : "") + newsProfile(t, pr) + rel(null, [t.name]);
    const tx = { 退団: cl ? `${cl}へ完全移籍することが決まりました。` : "退団することになりました。", レンタル移籍: `${cl || "他クラブ"}へ期限付き移籍することが決まりました。`,
      レンタル復帰: "期限付き移籍先から復帰します。", 加入: "加入することが決まりました。", レンタル加入: "期限付き移籍で加入することが決まりました。" }[t.kind] || `${esc(t.kind)}のお知らせです。`;
    const kindJ = { 退団: t.club ? "完全移籍" : "退団", レンタル移籍: "期限付き移籍", レンタル復帰: "期限付き移籍から復帰", 加入: "完全移籍で加入", レンタル加入: "期限付き移籍で加入" }[t.kind] || esc(t.kind);
    const out = /^(退団|レンタル移籍)$/.test(t.kind), inn = /^(加入|レンタル加入)$/.test(t.kind);
    return P(`${esc(t.name)}選手が${tx}`)
      + T([["種別", kindJ], [out ? "移籍先" : "前所属", t.club && (out || inn) ? cl : ""], ["契約期間", t.years ? `${t.years}年` : ""], ["移籍金", t.fee != null ? money(t.fee) : ""], ["メモ", esc(t.memo || "")]])
      + newsProfile(t, pr) + rel(null, [t.name]); }
  return P(`${esc(n.season)}シーズン、${esc(n.title)}で優勝しました！\n応援ありがとうございました。`) + `<p class="nbtn"><a class="btn" href="#/club">CLUB</a></p>`;
}
/* 記事の下の選手プロフィール（Jクラブの発表文の形） */
function newsProfile(t, pr) {
  if (!pr || !pr.name) return "";
  const ag = age(pr.birth, t.date);
  const hist = historyRows(pr, t.name, []).filter(r => !r.note || r.school || r.own).map(r => [r.c, r.p]);
  const rows = [["選手名", `${esc(t.name)}${pr.roma ? `<small>${esc(pr.roma)}</small>` : ""}`], ["ポジション", esc(t.pos || pr.pos || "")],
    ["生年月日", pr.birth ? `${pr.birth.getFullYear()}年${pr.birth.getMonth() + 1}月${pr.birth.getDate()}日（${ag}歳）` : ""], ["出身地", esc(pr.pref || "")],
    ["身長／体重", [pr.height ? pr.height + "cm" : "", pr.weight ? pr.weight + "kg" : ""].filter(Boolean).join("／")], ["利き足", esc(pr.foot || "")],
    ["経歴", hist.map(([c, pr2], i) => `<span class="nh">${i ? "→ " : ""}${esc(c)}<i>（${esc(pr2)}）</i></span>`).join("")]].filter(r => r[1]);
  return `<div class="nprof"><h3>PROFILE<small>プロフィール</small></h3><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div>`;
}
function vNewsDetail(id) {
  const all = buildNews(), i = all.findIndex(n => n.id === id), n = all[i];
  if (!n) return band("NEWS", "ニュース") + `<div class="wrap narrow">${empty("記事が見つかりません。")}</div>`;
  const pv = all[i + 1], nx = all[i - 1];
  return band("NEWS", "ニュース") + `<div class="wrap narrow"><article class="art"><div class="nmeta"><time>${dotY(n.d)}</time>${catTag(n)}</div>
    <h1>${esc(n.t)}</h1><div class="art-th">${newsThumb(n)}</div><div class="art-b">${newsBody(n)}</div></article>
    <nav class="mnav">${pv ? `<a class="mnav-a" href="#/news/${encodeURIComponent(pv.id)}"><small>‹ 前の記事</small><b>${esc(pv.t)}</b></a>` : "<span></span>"}<a class="btn" href="#/news">NEWS</a>${nx ? `<a class="mnav-a" href="#/news/${encodeURIComponent(nx.id)}"><small>次の記事 ›</small><b>${esc(nx.t)}</b></a>` : "<span></span>"}</nav></div>`;
}

function vNews(id) {
  if (id) return vNewsDetail(id);
  const all = buildNews(), cats = [...Object.keys(NCAT), "ALL"];
  if (!cats.includes(ST.ncat)) ST.ncat = "ALL";
  const L = all.filter(n => ST.ncat === "ALL" || ncat(n) === ST.ncat);
  return band("NEWS", "ニュース") + `<div class="wrap">
    <div class="pills" id="ncat">${cats.map(c => `<button class="pill${c === ST.ncat ? " on" : ""}" data-c="${c}">${c === "ALL" ? "すべて" : NCAT[c]}</button>`).join("")}</div>
    ${L.length ? `<div class="ngrid">${L.slice(0, 60).map(newsCard).join("")}</div>` : `<div class="panel">${empty(ST.ncat === "ALL" ? "ニュースはまだありません。" : "このカテゴリーの記事はまだありません。")}</div>`}</div>`;
}
function bNews() { document.querySelectorAll("#ncat .pill").forEach(b => b.onclick = () => { ST.ncat = b.dataset.c; render(); }); }
