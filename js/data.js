/* データの読み込みと整形 */

/* ---------- データ ---------- */
const D = { staff: [], rankHist: {}, clubs: {}, loans: [], conf: {}, matches: [], played: [], players: [], growth: [], trans: [], table: [], seasons: [], lineups: [], seasonList: [], err: "" };
const ST = { season: null, comp: "すべて", mtab: "facts", trSeason: null };
const clubName = () => D.conf["クラブ名"] || DEFAULT_CLUB;
/* 買収前のクラブ名（設定の「旧クラブ名」）。旧名のアカデミー・トップチームも自クラブの歴史として扱う */
const oldName = () => D.conf["旧クラブ名"] || "";
const renameDate = () => pDate(D.conf["クラブ名変更日"]) || (proYear() ? new Date(proYear(), 6, 1) : null);
const isOwn = v => !!v && (v.includes(clubName()) || (!!oldName() && v.includes(oldName())));
const shortName = () => D.conf["略称"] || clubName();
function isMe(club) { const k = nameKey(club); return !!k && (k === nameKey(clubName()) || k === nameKey(D.conf["略称"]) || k === nameKey(DEFAULT_CLUB) || /^自分/.test(club)); }
/* チーム列：チーム名（推奨）または 自分／相手 */
const sideOf = s => { s = String(s || "").trim(); return !s || s === "自分" ? "me" : /^(相手|opp|away)$/i.test(s) ? "opp" : isMe(s) ? "me" : "opp"; };

/* 出場選手シートの数字の列（チームスタッツに無いときは選手の合計を使う） */
const LU_NUM = ["出場時間", "評価", "得点", "アシスト", "シュート", "枠内シュート", "ゴール期待値", "パス", "パス成功", "キーパス", "ドリブル", "ドリブル成功",
  "タックル", "タックル成功", "インターセプト", "ブロック", "クリア", "走行距離", "セーブ", "失点", "警告", "退場"];
const TS_NUM = ["ボール支配率", "ボール奪取時間", "シュート", "ゴール期待値", "パス", "タックル", "タックル成功", "インターセプト", "セーブ", "ファウル", "オフサイド",
  "コーナーキック", "フリーキック", "PK", "警告", "退場", "枠内シュート", "枠外シュート", "ブロックされたシュート", "ペナルティエリア内シュート", "ペナルティエリア外シュート", "ボックス内シュート", "パス成功", "キーパス",
  "クロス", "スルーパス", "ドリブル", "ドリブル成功", "クリア", "ブロック", "空中戦勝利", "走行距離"];
const TS_FROM_PLAYERS = ["シュート", "枠内シュート", "ゴール期待値", "パス", "パス成功", "キーパス", "ドリブル", "ドリブル成功", "タックル", "タックル成功", "インターセプト", "ブロック", "クリア", "セーブ", "警告", "退場", "走行距離"];
const LU_SUMMABLE = new Set(["シュート", "枠内シュート", "ゴール期待値", "パス", "パス成功", "キーパス", "ドリブル", "ドリブル成功", "タックル", "タックル成功",
  "インターセプト", "ブロック", "クリア", "セーブ", "警告", "退場", "走行距離"]);

function parseNames(s) {
  return String(s || "").split(/[、,，\n／\/]/).map(t => t.trim()).filter(Boolean).map(t => {
    const m = half(t).match(/^(.*?)[\s　]*[（(×xX]?\s*(\d+)\s*[)）点]?$/);
    if (m && m[1].trim()) return { name: m[1].trim(), n: +m[2] };
    return { name: t, n: 1 };
  });
}
function parsePK(s) { const m = half(s).match(/(\d+)\s*[-ー:－]\s*(\d+)/); return m ? { a: +m[1], b: +m[2] } : null; }
function minN(s) { const m = half(s).match(/(\d+)(?:\s*\+\s*(\d+))?/); return m ? +m[1] + (m[2] ? +m[2] / 100 : 0) : 999; }

async function loadAll() {
  const keys = Object.keys(SHEETS);
  const res = await Promise.allSettled(keys.map(fetchSheet));
  const got = {}; let fails = 0;
  keys.forEach((k, i) => { if (res[i].status === "fulfilled") got[k] = res[i].value; else { got[k] = []; fails++; console.warn(SHEETS[k][0], res[i].reason); } });
  if (fails === keys.length) D.err = "データを読み込めませんでした。時間をおいて再読み込みしてください。";

  got.conf.forEach(o => { const k = F(o, "項目"), v = F(o, "値"); if (k) D.conf[k] = v; });
  got.li.forEach(o => { const n = F(o, "クラブ"); if (n) D.clubs[nameKey(n)] = { name: n, short: F(o, "略称"), country: F(o, "国"), league: F(o, "リーグ"), color: F(o, "チームカラー"), color2: F(o, "サブカラー") }; });
  const col = D.conf["テーマカラー"]; if (/^#[0-9a-f]{3,8}$/i.test(col || "")) document.documentElement.style.setProperty("--me", col);

  D.players = got.pl.map(o => ({
    name: F(o, "名前"), roma: F(o, "ローマ字"), pref: F(o, "出身地"), no: num(F(o, "背番号")), pos: F(o, "ポジション").toUpperCase(), nat: F(o, "国籍"), birth: pDate(F(o, "生年月日")),
    foot: F(o, "利き足"), height: num(F(o, "身長")), weight: num(F(o, "体重")), ovr: num(F(o, "総合値")), pot: num(F(o, "ポテンシャル")), value: num(F(o, "市場価値")),
    joined: F(o, "加入"), origin: F(o, "出身"), schools: [["小学", F(o, "小学"), 6, 6], ["中学", F(o, "中学"), 12, 3], ["高校", F(o, "高校"), 15, 3]], status: F(o, "在籍") || "在籍", photo: F(o, "写真"), memo: F(o, "メモ"), cap: F(o, "主将")
  })).filter(p => p.name);
  /* 役職が入っている行はスタッフ */
  const roleOf = {}; got.pl.forEach(o => { const n = F(o, "名前"), r = F(o, "役職"); if (n && r) roleOf[nameKey(n)] = r; });
  D.staff = D.players.filter(p => roleOf[nameKey(p.name)]).map(p => Object.assign(p, { role: roleOf[nameKey(p.name)] }));
  D.players = D.players.filter(p => !roleOf[nameKey(p.name)]);

  /* 試合シート：自分の試合と他クラブの試合が混ざっている（ホーム／アウェイ形式） */
  const OX = []; D.ox = OX;
  /* 他クラブの試合シート（PrincipaleのPK欄と同じく ホーム-アウェイ の順） */
  (got.ox || []).forEach(o => { const home = F(o, "ホーム"), away = F(o, "アウェイ"), hg = num(F(o, "ホーム得点")), ag = num(F(o, "アウェイ得点"));
    if (!home || !away || hg == null || ag == null || isMe(home) || isMe(away)) return;
    OX.push({ season: F(o, "シーズン"), date: pDate(F(o, "日付")), comp: F(o, "大会"), round: F(o, "節・ラウンド"), home, away, hg, ag, pk: parsePK(F(o, "PK")) }); });
  /* 負傷シート：日付・選手・負傷内容・離脱期間＋単位（または復帰予定日）・復帰日 */
  D.inj = (got.inj || []).map((o, i) => { const name = F(o, "選手"), date = pDate(F(o, "日付")); if (!name || !date) return null;
    const n = num(F(o, "離脱期間")), u = F(o, "単位") || "週", add = n == null ? null : u === "日" ? n : u === "か月" ? n * 30 : n * 7;
    const back = pDate(F(o, "復帰予定日")) || (add != null ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + Math.round(add)) : null);
    return { i, name, date, what: F(o, "負傷内容"), n, u, back, ret: pDate(F(o, "復帰日")), memo: F(o, "メモ") }; }).filter(Boolean).sort((a, b) => a.date - b.date);
  D.matches = got.match.map((o, i) => {
    const home = F(o, "ホーム"), away = F(o, "アウェイ"); if (!home || !away) return null;
    const hg = num(F(o, "ホーム得点")), ag = num(F(o, "アウェイ得点")), pkr = parsePK(F(o, "PK")), date = pDate(F(o, "日付"));
    if (!isMe(home) && !isMe(away)) { if (hg != null && ag != null) OX.push({ season: F(o, "シーズン"), date, comp: F(o, "大会"), home, away, hg, ag }); return null; }
    const ha = isMe(home) ? "H" : "A", opp = ha === "H" ? away : home;
    const gf = ha === "H" ? hg : ag, ga = ha === "H" ? ag : hg, played = gf != null && ga != null;
    const pk = pkr ? (ha === "H" ? pkr : { a: pkr.b, b: pkr.a }) : null;
    const res = !played ? "U" : gf > ga ? "W" : gf < ga ? "L" : pk ? (pk.a > pk.b ? "W" : "L") : "D";
    return { i, season: F(o, "シーズン"), date, key: dKey(date), comp: F(o, "大会") || "試合", round: F(o, "節・ラウンド"), ha, opp, gf, ga, pk, res, played,
      scorers: parseNames(F(o, "得点者")), assists: parseNames(F(o, "アシスト")), mom: F(o, "MOM"), stadium: F(o, "スタジアム"), kick: half(F(o, "キックオフ")), weather: F(o, "天気"), att: num(F(o, "観客数")),
      memo: F(o, "メモ"), video: F(o, "動画"), ts: {}, form: {}, lu: [], luOpp: [], bench: [], benchOpp: [], ev: [] };
  }).filter(Boolean);
  D.matches.sort((a, b) => (a.date && b.date ? a.date - b.date : 0) || a.i - b.i);
  D.matches.forEach((m, k) => m.id = k + 1);
  const byKey = {}; D.matches.forEach(m => { if (m.key && !byKey[m.key]) byKey[m.key] = m; });

  got.ts.forEach(o => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; if (!m) return;
    const side = sideOf(F(o, "チーム")), t = {};
    TS_NUM.forEach(h => { const v = num(F(o, h)); if (v != null) t[h] = v; });
    /* 旧見出し「ボックス内シュート」は「ペナルティエリア内シュート」として扱う。外は未入力なら シュート−内 で出す */
    if (t["ペナルティエリア内シュート"] == null && t["ボックス内シュート"] != null) t["ペナルティエリア内シュート"] = t["ボックス内シュート"];
    if (t["ペナルティエリア外シュート"] == null && t["シュート"] != null && t["ペナルティエリア内シュート"] != null) t["ペナルティエリア外シュート"] = Math.max(0, t["シュート"] - t["ペナルティエリア内シュート"]);
    m.ts[side] = t; m.form[side] = F(o, "フォーメーション");
  });
  D.lineups = got.lu.map((o, i) => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; const name = F(o, "名前"); if (!m || !name) return null;
    const s = {}; LU_NUM.forEach(h => { const v = num(F(o, h)); if (v != null) s[h] = v; });
    const l = { i, m, name, side: sideOf(F(o, "チーム")), role: F(o, "出場") || "先発", no: num(F(o, "背番号")), pos: F(o, "ポジション").toUpperCase(), s, rating: s["評価"] ?? null, totw: /^(true|1|○|◯|✓|✔|y|yes)$/i.test(String(F(o, "TOTW")).trim()) };
    /* ベンチ登録でも出場時間か評価が入っていれば途中出場。使われなかった選手は控えとして別に持つ */
    if (l.role === "ベンチ" && ((s["出場時間"] || 0) > 0 || l.rating != null)) l.role = "途中出場";
    if (l.role === "ベンチ") { (l.side === "opp" ? m.benchOpp : m.bench).push(l); return null; }
    (l.side === "opp" ? m.luOpp : m.lu).push(l);
    return l.side === "opp" ? null : l;
  }).filter(Boolean);
  got.ev.forEach((o, i) => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; if (!m) return;
    m.ev.push({ i, min: half(F(o, "分")), mn: minN(F(o, "分")), side: sideOf(F(o, "チーム")), kind: F(o, "種類") || "その他",
      player: F(o, "選手"), rel: F(o, "関連する選手"), note: F(o, "補足"), video: F(o, "動画") });
  });
  D.matches.forEach(m => {
    /* チームスタッツが空欄の項目は、出場した選手の数字の合計で埋める */
    [["me", m.lu], ["opp", m.luOpp || []]].forEach(([side, L]) => {
      const t = m.ts[side] || (m.ts[side] = {});
      TS_FROM_PLAYERS.forEach(k => { if (t[k] != null) return; const v = L.map(l => l.s[k]).filter(x => x != null); if (v.length) t[k] = Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100; });
      if (!Object.keys(t).length) delete m.ts[side]; });
    m.ev.forEach(e => { e.ord = phaseOrd(e);
      /* シュートは「打った側」で記録する。旧い書き方（シュート／枠内シュート／セーブ）も読めるように */
      if (e.kind === "シュート") e.kind = "シュート（枠外）";
      else if (e.kind === "枠内シュート") e.kind = "シュート（セーブ）";

      /* オウンゴール：チーム列は蹴った選手のチームなので、得点は相手側に付ける */
      if (e.kind === "オウンゴール") { const mine = m.lu.concat(m.bench || []).some(l => same(l.name, e.player)), opp = (m.luOpp || []).concat(m.benchOpp || []).some(l => same(l.name, e.player));
        e.side = mine ? "opp" : opp ? "me" : e.side === "me" ? "opp" : "me"; } });
    m.ev.sort((a, b) => a.ord - b.ord || a.i - b.i);
    /* 試合シートのPKが空欄なら、試合経過のPK戦の記録から計算 */
    const kicks = m.ev.filter(e => /^PK戦（成功）/.test(e.kind));
    if (!m.pk && m.played && m.gf === m.ga && m.ev.some(e => /^PK戦（/.test(e.kind))) {
      m.pk = { a: kicks.filter(e => e.side === "me").length, b: kicks.filter(e => e.side === "opp").length };
      m.res = m.pk.a > m.pk.b ? "W" : m.pk.a < m.pk.b ? "L" : "D"; }
    if (!m.played) return;
    /* 得点者・アシストが空欄なら、出場選手 → 試合経過 の順で補う */
    if (!m.scorers.length) {
      const L = m.lu.filter(l => l.s["得点"]);
      m.scorers = L.length ? L.map(l => ({ name: l.name, n: l.s["得点"] }))
        : count(m.ev.filter(e => e.side === "me" && isGoal(e) && e.kind !== "オウンゴール").map(e => e.player));
    }
    if (!m.assists.length) {
      const L = m.lu.filter(l => l.s["アシスト"]);
      m.assists = L.length ? L.map(l => ({ name: l.name, n: l.s["アシスト"] }))
        : count(m.ev.filter(e => e.side === "me" && isGoal(e) && e.rel).map(e => e.rel));
    }
    /* MOM が空欄なら最高評価の選手（勝ったチームから。引き分けは両チームから） */
    if (!m.mom) { const r = (m.res === "W" ? m.lu : m.res === "L" ? (m.luOpp || []) : [...m.lu, ...(m.luOpp || [])]).filter(l => l.rating != null).sort((a, b) => b.rating - a.rating)[0]; if (r) { m.mom = r.name; m.momL = r; } }
    else m.momL = m.lu.find(l => same(l.name, m.mom));
  });
  D.played = D.matches.filter(m => m.played);

  /* 選手の推移：1シーズン1行、7月〜6月の列（「7月総合」「7月ポテ」「7月価値」）。日付列がある古い形にも対応 */
  D.growth = [];
  got.gr.forEach(o => {
    const name = F(o, "名前"), season = F(o, "シーズン"); if (!name) return;
    if (F(o, "日付")) { D.growth.push({ date: pDate(F(o, "日付")), season, name, ovr: num(F(o, "総合値")), pot: num(F(o, "ポテンシャル")), value: num(F(o, "市場価値")) }); return; }
    const y = parseInt(season, 10); if (!y) return;
    [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].forEach(m => D.growth.push({ date: new Date(m >= 7 ? y : y + 1, m - 1, 1), season, name,
      ovr: num(F(o, m + "月総合")), pot: num(F(o, m + "月ポテ")), value: num(F(o, m + "月価値")) }));
  });
  D.growth = D.growth.filter(g => g.ovr != null || g.pot != null || g.value != null).sort((a, b) => (a.date || 0) - (b.date || 0));
  D.trans = got.tr.map((o, i) => ({ i, season: F(o, "シーズン"), date: pDate(F(o, "日付")), kind: F(o, "区分") || "加入", name: F(o, "名前"), pos: F(o, "ポジション").toUpperCase(),
    age: num(F(o, "年齢")), club: F(o, "相手クラブ"), fee: num(F(o, "移籍金")), years: parseInt(half(F(o, "契約年数")), 10) || null, memo: F(o, "メモ") })).filter(t => t.name);
  D.table = [];
  /* 他クラブの試合が入っている大会は、自分の試合と合わせて順位表を自動で計算する（順位表シートより優先） */
  const ox = OX;
  [...new Set(ox.map(r => r.season + "\t" + r.comp))].forEach(k => {
    const [season, comp] = k.split("\t");
    /* 1試合＝{d, a, b, ga, gb}。自分の試合も同じ形にまとめる */
    const G = ox.filter(r => r.season === season && r.comp === comp).map(r => ({ d: r.date, a: r.home, b: r.away, ga: r.hg, gb: r.ag }))
      .concat(D.played.filter(m => m.season === season && m.comp === comp).map(m => ({ d: m.date, a: clubName(), b: m.opp, ga: m.gf, gb: m.ga, m })));
    G.sort((x, y) => (x.d || 0) - (y.d || 0));
    const base = D.table.filter(r => r.season === season && r.comp === comp).map(r => r.club);
    const build = upto => {
      const T = {};
      const get = c => T[nameKey(c)] || (T[nameKey(c)] = { club: c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, form: [] });
      base.forEach(get);
      G.filter(g => !upto || !g.d || g.d <= upto).forEach(g => [[g.a, g.ga, g.gb], [g.b, g.gb, g.ga]].forEach(([c, f, x]) => {
        const t = get(c), r = f > x ? "W" : f < x ? "L" : "D"; t.p++; t.gf += f; t.ga += x; t[r.toLowerCase()]++; t.form.push(r); }));
      const rows = Object.values(T).map(t => Object.assign(t, { season, comp, pts: t.w * 3 + t.d, form: t.form.slice(-5) }));
      rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.club.localeCompare(b.club, "ja"));
      rows.forEach((r, i) => r.rank = i + 1);
      return rows;
    };
    D.table = D.table.filter(r => !(r.season === season && r.comp === comp)).concat(build(null));
    /* 自分の順位の推移（自分の試合ごと） */
    D.rankHist[k] = G.filter(g => g.m).map(g => ({ m: g.m, rank: (build(g.d).find(r => isMe(r.club)) || {}).rank })).filter(x => x.rank);
  });
  /* 個人タイトル：1行1受賞（シーズン・大会・タイトル・選手） */
  D.awards = (got.aw || []).map(o => ({ season: F(o, "シーズン"), comp: F(o, "大会"), title: F(o, "タイトル"), name: F(o, "選手"), month: F(o, "対象月"), date: pDate(F(o, "発表日")), memo: F(o, "メモ") })).filter(a => a.name && a.title);

  /* リーグ順位は自動（シーズンの「リーグ」の順位表から） */
  /* シーズンの情報はすべて自動（シーズンシートは使わない）
     リーグ：その季のリーグ戦の大会／順位：順位表／タイトル：リーグ戦を全部終えて1位、カップ戦は決勝で勝利／主将：選手シートの「主将」列 */
  const capOf = se => (D.players.find(p => String(p.cap || "").split(/[、,，\s]+/).includes(se)) || {}).name || "";
  D.seasons = [...new Set(D.matches.map(m => m.season).filter(Boolean))].sort().map(se => {
    const lg = (D.matches.find(m => m.season === se && tier(m.comp)) || {}).comp || "", L = D.matches.filter(m => m.season === se && m.comp === lg);
    const r = D.table.find(t => t.season === se && t.comp === lg && isMe(t.club)), titles = [];
    if (L.length && L.every(m => m.played) && r && r.rank === 1) titles.push(lg);
    D.matches.filter(m => m.season === se && m.played && !tier(m.comp) && /決勝/.test(m.round || "") && !/準/.test(m.round || "") && (m.res === "W" || (m.pk && m.pk.a > m.pk.b))).forEach(m => titles.push(m.comp));
    return { season: se, league: lg, rank: r ? r.rank : null, titles: titles.join("、"), cap: capOf(se), fa: "", comment: "" };
  });
  /* 選手の推移シート：レンタル先が入っている行は、レンタル先での成績 */
  D.loans = got.gr.map(o => ({ season: F(o, "シーズン"), date: pDate(F(o, "日付")), name: F(o, "名前"), club: F(o, "レンタル先"), apps: num(F(o, "出場")), g: num(F(o, "得点")),
    a: num(F(o, "アシスト")), rating: num(F(o, "平均評価")), memo: F(o, "メモ") })).filter(x => x.name && x.club).sort((x, y) => (x.date || 0) - (y.date || 0));
  const ss = new Set([...D.matches, ...D.trans, ...D.table, ...D.seasons, ...D.loans].map(x => x.season).filter(Boolean));
  if (!ss.size && D.conf["最初のシーズン"]) ss.add(D.conf["最初のシーズン"]);
  /* 最初のシーズンより前（ノンリーグ時代）はシーズン選択に出さない */
  const first = D.conf["最初のシーズン"] || "";
  D.seasonList = [...ss].filter(x => !first || x >= first).sort().reverse();
  if (!D.seasonList.length) D.seasonList = [curSeason()];
  const last = D.played[D.played.length - 1];
  ST.season = ST.cur = (last && last.season) || D.seasonList[0];
}
/* 今のシーズン（7月はじまり。例：2026年11月 → 2026-27） */
function curSeason() { const t = gameToday(), y = t.getFullYear(); return t.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; }
/* 試合の区切り（キックオフ・ハーフタイムなど）。分が空欄でも正しい位置に並べる */
const PHASE = { キックオフ: ["KICK OFF", -1], 前半終了: ["HALF TIME", 45.98], 後半開始: ["SECOND HALF", 45.99], 後半終了: ["END OF 2ND HALF", 90.98], 延長開始: ["EXTRA TIME", 90.99], 延長前半終了: ["ET HALF TIME", 105.98], 延長後半開始: ["ET SECOND HALF", 105.99], 延長終了: ["END OF EXTRA TIME", 120.98], PK戦: ["PENALTY SHOOT-OUT", 9998], 試合終了: ["FULL TIME", 9999] };
const MINOR = ["セーブ", "シュート（枠外）", "シュート（セーブ）", "シュート（ブロック）", "ポスト・バー", "オフサイド", "ビッグチャンス"];
function phaseOrd(e) { if (/^PK戦（/.test(e.kind)) return 9998.5; const p = PHASE[e.kind]; return p ? p[1] : e.mn; }
/* YouTube */
function ytInfo(u) { u = String(u || "").trim(); if (!u) return null;
  const m = u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || u.match(/^([\w-]{11})$/); if (!m) return null;
  const t = u.match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?/); const st = t ? (+t[1] || 0) * 3600 + (+t[2] || 0) * 60 + (+t[3] || 0) : 0;
  return { id: m[1], st }; }
function ytBox(u, cls) { const y = ytInfo(u); if (!y) return "";
  return `<div class="yt ${cls || ""}" data-id="${y.id}" data-st="${y.st}" onclick="ytPlay(this)" role="button" aria-label="動画を再生"><img src="https://i.ytimg.com/vi/${y.id}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play"><svg viewBox="0 0 68 48"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.3.3 34 .3 34 .3s-21.3 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.7 47.7 34 47.7 34 47.7s21.3 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#e00"/><path d="M27 34V14l18 10z" fill="#fff"/></svg></span></div>`; }
window.ytPlay = el => { if (el.querySelector("iframe")) return;
  el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${el.dataset.id}?autoplay=1&rel=0&playsinline=1${+el.dataset.st ? "&start=" + el.dataset.st : ""}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="YouTube"></iframe>`;
  el.classList.add("on"); };
const isGoal = e => /ゴール/.test(e.kind) && !/失敗/.test(e.kind);
function count(names) { const c = {}; names.filter(Boolean).forEach(n => c[n] = (c[n] || 0) + 1); return Object.keys(c).map(n => ({ name: n, n: c[n] })); }
