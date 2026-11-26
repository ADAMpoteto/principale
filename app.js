/* =====================================================================
   Principale ― 記録サイト
   データは Google スプレッドシート「Principale」から読み込みます。

   ■ スプシのつなぎ方
     スプシを「ファイル → 共有 → ウェブに公開（ドキュメント全体）」しておく（済み）。
     うまく出ないときは「共有 → リンクを知っている全員（閲覧者）」にもしておく。
   ■ 画像（GitHub の images フォルダに、名前と同じファイル名で置くだけ）
     選手の写真 : images/player/高橋 蒼.png   （.webp / .jpg でもOK）
     クラブロゴ : images/logo/鹿島アントラーズ.png （試合シートの「相手」と同じ名前）
   ===================================================================== */
const SHEET_ID = "1OzrkAMDzxO5N2yAj78FubFt8SHacgZ84hXqXwNZc1HY";
const PUB_ID   = "2PACX-1vS2hqvKKGnEgDYn-X8WOfquzm-DOxuOdzXo1KkNW5o7Jy342lgvZsvFhGupZcAZptF-cWSJhvtT3XR0";
const SHEETS = {          // キー: [シート名, gid]
  conf:  ["設定", 2],
  match: ["試合", 3],
  ts:    ["チームスタッツ", 4],
  lu:    ["出場選手", 5],
  ev:    ["試合経過", 6],
  pl:    ["選手", 7],
  gr:    ["選手の推移", 8],
  tr:    ["移籍", 9],
  ss:    ["シーズン", 11],
  li:    ["クラブ", 14],
  aw:    ["個人タイトル", 13],
  ox:    ["他クラブの試合", 17],
  inj:   ["負傷", 18]
};
const DEFAULT_CLUB = "Principale";
const DEMO = /[?&]demo\b/.test(location.search);
const IMG_EXT = ["png", "webp", "jpg"];

/* ---------- 小物 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const half = s => String(s == null ? "" : s).replace(/[０-９．－，＋％：]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const F = (o, k) => (o && o[k] != null) ? String(o[k]).trim() : "";
function num(s) { const t = half(s).replace(/[,\s%€¥$円万人]/g, ""); if (t === "") return null; const n = Number(t); return isFinite(n) ? n : null; }
function pDate(s) { const m = half(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
const pad = n => String(n).padStart(2, "0");
const dKey = d => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const fmtD = d => d ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}` : "";
const fmtMD = d => d ? `${d.getMonth() + 1}/${d.getDate()}` : "";
const fmtDW = d => d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）` : "";
const nameKey = s => String(s || "").replace(/[\s　・.]/g, "").toLowerCase();
const same = (a, b) => nameKey(a) === nameKey(b);
const sum = (L, f) => L.reduce((a, x) => a + (f(x) || 0), 0);
const fmtN = (v, d = 0) => v == null || !isFinite(v) ? "-" : Number(v).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d });
const empty = msg => `<div class="empty">${esc(msg)}</div>`;
function money(v) {
  if (v == null) return "";
  const u = D.conf["通貨の単位"] || "€", a = Math.abs(v);
  const s = a >= 1e6 ? fmtN(v / 1e6, a % 1e6 ? 1 : 0) + "M" : a >= 1e3 ? fmtN(v / 1e3, 0) + "K" : fmtN(v);
  const sg = v < 0 ? "-" : "", s2 = s.replace(/^-/, "");
  return sg + (/[€$£]/.test(u) ? u + s2 : s2 + u);
}
/* スローガン：前半はベタ、後半は縁取り（「,」「、」で区切る） */
function slogan(t) {
  t = String(t || "").trim(); if (!t) return "";
  let i = t.search(/[,、，]/), a, b;
  if (i >= 0) { a = t.slice(0, i + 1); b = t.slice(i + 1).trim(); } else { const w = t.split(/\s+/); a = w.slice(0, Math.ceil(w.length / 2)).join(" "); b = w.slice(Math.ceil(w.length / 2)).join(" "); }
  return `<span class="slg"><b>${esc(a)}</b>${b ? ` <i>${esc(b)}</i>` : ""}</span>`;
}
/* ゲーム内の今日：設定の「ゲーム内の日付」、なければ記録の中で一番新しい日付 */
let GAME_TODAY = null;
function gameToday() {
  if (GAME_TODAY) return GAME_TODAY;
  const c = typeof D !== "undefined" && D.conf ? pDate(D.conf["ゲーム内の日付"] || "") : null;
  if (c) return GAME_TODAY = c;
  if (typeof D === "undefined" || !D.played) return new Date();
  const ds = [...(D.played || []), ...(D.trans || []), ...(D.growth || [])].map(x => x.date).filter(d => d && !isNaN(d));
  return GAME_TODAY = ds.length ? new Date(Math.max(...ds)) : new Date();
}
function age(birth, at) { if (!birth) return null; const t = at || gameToday(); let a = t.getFullYear() - birth.getFullYear(); if (t.getMonth() < birth.getMonth() || (t.getMonth() === birth.getMonth() && t.getDate() < birth.getDate())) a--; return a; }

/* ---------- 読み込み ---------- */
function sheetUrls(key) {
  const [name, gid] = SHEETS[key];
  if (DEMO) return [`demo/${encodeURIComponent(name)}.csv`];
  return [
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${gid}&single=true&output=csv`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`
  ];
}
function cleanRows(rows) {
  return (rows || []).map(o => { const n = {}; Object.keys(o).forEach(k => { n[String(k).replace(/^﻿/, "").replace(/\s+/g, "")] = o[k]; }); return n; })
    .filter(o => Object.values(o).some(v => String(v == null ? "" : v).trim() !== ""));
}
async function fetchSheet(key) {
  let last;
  for (const url of sheetUrls(key)) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const text = await r.text();
      if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("HTML");
      return cleanRows(Papa.parse(text, { header: true, skipEmptyLines: "greedy" }).data);
    } catch (e) { last = e; }
  }
  throw last;
}

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
    joined: F(o, "加入"), origin: F(o, "出身"), schools: [["小学", F(o, "小学"), 6, 6], ["中学", F(o, "中学"), 12, 3], ["高校", F(o, "高校"), 15, 3]], status: F(o, "在籍") || "在籍", photo: F(o, "写真"), memo: F(o, "メモ")
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
  D.seasons = got.ss.map(o => ({ season: F(o, "シーズン"), league: F(o, "リーグ"), rank: null, titles: F(o, "獲得タイトル"), cap: F(o, "主将"), fa: F(o, "FAカップ"), comment: F(o, "一言") })).filter(s => s.season);
  /* 個人タイトル：1行1受賞（シーズン・大会・タイトル・選手） */
  D.awards = (got.aw || []).map(o => ({ season: F(o, "シーズン"), comp: F(o, "大会"), title: F(o, "タイトル"), name: F(o, "選手"), month: F(o, "対象月"), date: pDate(F(o, "発表日")), memo: F(o, "メモ") })).filter(a => a.name && a.title);

  /* リーグ順位は自動（シーズンの「リーグ」の順位表から） */
  D.seasons.forEach(s => { const r = D.table.find(t => t.season === s.season && t.comp === (s.league || D.conf["リーグ"]) && isMe(t.club)); if (r) s.rank = r.rank; });
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

/* ---------- 画像（なければ頭文字） ---------- */
const IMG_OK = {};
function imgCands(dir, names) {
  const out = [];
  names.filter(Boolean).forEach(n => [...new Set([String(n).trim(), String(n).replace(/[\s　]/g, "")])].forEach(b =>
    IMG_EXT.forEach(e => out.push(`images/${dir}/${b}.${e}`))));
  return [...new Set(out)];
}
function initials(name) {
  const s = String(name || "").trim(); if (!s) return "?";
  if (/^[\p{Script=Latin}\s.'’-]+$/u.test(s)) { const w = s.replace(/[^A-Za-z0-9\s]/g, " ").split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : s.slice(0, 2)).toUpperCase(); }
  return s.split(/[\s　]+/)[0].slice(0, 2);
}
const IMG_V = ((document.currentScript && document.currentScript.src || "").match(/[?&]v=([^&]+)/) || [])[1] || "";
const imgSrc = p => encodeURI(String(p).split("?")[0]) + (IMG_V ? "?v=" + IMG_V : "");
function imgTag(cands, alt, cls, key, phTxt) {
  const list = IMG_OK[key] ? [IMG_OK[key]] : cands, ini = phTxt || initials(alt);
  if (IMG_OK[key] === false || !list.length) return `<div class="${cls} ph" role="img" aria-label="${esc(alt)}">${esc(ini)}</div>`;
  return `<img class="${cls}" src="${esc(imgSrc(list[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async" data-k="${esc(key)}" data-c="${esc(list.slice(1).join("|"))}"
    data-i="${esc(ini)}" onload="imgOk(this)" onerror="imgNext(this)">`;
}
window.imgOk = el => { const k = el.dataset.k; if (k) IMG_OK[k] = decodeURI(el.getAttribute("src").split("?")[0]); };
window.imgNext = el => {
  const rest = (el.dataset.c || "").split("|").filter(Boolean);
  if (rest.length) { el.dataset.c = rest.slice(1).join("|"); el.src = imgSrc(rest[0]); return; }
  if (el.dataset.k) IMG_OK[el.dataset.k] = false;
  const d = document.createElement("div"); d.className = el.className + " ph"; d.textContent = el.dataset.i || "?"; d.setAttribute("role", "img"); d.setAttribute("aria-label", el.alt || "");
  el.replaceWith(d);
};
const prof = name => D.players.find(p => same(p.name, name));
function face(name, cls, no) {
  const p = prof(name), ph = p && p.photo, n = no != null && no !== "" ? no : p && p.no != null ? p.no : null;
  const c = (ph ? (/\.(png|webp|jpe?g|gif)$/i.test(ph) ? [`images/player/${ph}`] : imgCands("player", [ph])) : []).concat(imgCands("player", [name]));
  return imgTag(c, name, "face " + (cls || "") + (n != null ? " num" : ""), "p:" + nameKey(name), n != null ? String(n) : undefined);
}
function logo(club, cls) {
  const me = isMe(club), names = me ? [clubName(), DEFAULT_CLUB] : [club];
  return imgTag(imgCands("logo", names), me ? clubName() : club, "logo " + (cls || ""), "l:" + (me ? "__me" : nameKey(club)), shortOf(club));
}
/* クラブの略称・リーグ（クラブシート） */
const clubInfo = c => D.clubs[nameKey(c)] || {};
/* 相手のチームカラー（リストの「チームカラー」）。自分の色と近すぎる・未設定ならグレー */
function hexRGB(h) { const m = String(h || "").trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i); if (!m) return null; let x = m[1]; if (x.length === 3) x = x.replace(/./g, c => c + c); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); }
function oppColor(c) { const me = hexRGB(D.conf["テーマカラー"]) || [46, 149, 214];
  const ok = o => o && Math.hypot(o[0] - me[0], o[1] - me[1], o[2] - me[2]) >= 60 && (o[0] * 299 + o[1] * 587 + o[2] * 114) / 1000 <= 225;
  const o = [hexRGB(clubInfo(c).color), hexRGB(clubInfo(c).color2)].find(ok);
  return o ? "#" + o.map(v => v.toString(16).padStart(2, "0")).join("") : "#5f6b77"; }
/* 評価点の色 */
const rtChip = (r, cls) => r == null ? "" : `<span class="rt ${rtCls(r)}${cls ? " " + cls : ""}">${fmtN(r, 1)}</span>`;
function shortOf(c) { if (isMe(c)) return D.conf["略称"] || initials(clubName()); return clubInfo(c).short || initials(c); }
const clubName2 = c => `<span class="fn">${esc(c)}</span><span class="sn">${esc(shortOf(c))}</span>`;
const leagueOf = c => { const x = clubInfo(c); return [x.country, x.league].filter(Boolean).join("・"); };
/* 日本人縛り */
const isJP = p => !p.nat || /日本|japan/i.test(p.nat);
const flag = nat => (!nat || /日本|japan/i.test(nat)) ? `<svg class="flag" viewBox="0 0 30 20" aria-label="日本"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>` : "";
const isYouth = p => /ユース/.test(p.origin || "") || D.trans.some(t => same(t.name, p.name) && t.kind === "ユース昇格");
function onLoan(p) {
  if (/レンタル中/.test(p.status || "")) return true;
  const T = D.trans.filter(t => same(t.name, p.name) && /レンタル移籍|レンタル復帰/.test(t.kind)).sort((x, y) => (x.date || 0) - (y.date || 0));
  return !!T.length && T[T.length - 1].kind === "レンタル移籍";
}
function loanClub(name) {
  const T = D.trans.filter(t => same(t.name, name) && t.kind === "レンタル移籍").sort((x, y) => (x.date || 0) - (y.date || 0)).pop();
  const L = D.loans.filter(x => same(x.name, name)).pop();
  return (L && L.club) || (T && T.club) || "";
}
const ROLE_ORDER = ["監督", "ヘッドコーチ", "コーチ", "GKコーチ", "フィジカルコーチ", "アナリスト", "ユース監督"];
function staffList() {
  let S = D.staff.filter(p => !/退団/.test(p.status || ""));
  if (!S.some(p => p.role === "監督") && D.conf["監督名"]) S = [{ name: D.conf["監督名"], role: "監督" }, ...S];
  const o = r => { const i = ROLE_ORDER.indexOf(r); return i < 0 ? 99 : i; };
  return S.sort((a, b) => o(a.role) - o(b.role));
}
function staffCard(p) {
  return `<a class="pcard staff" href="#/staff/${encodeURIComponent(p.name)}"><div class="ph-wrap">${face(p.name)}<span class="pos">${esc(p.role)}</span></div>
    <div class="info"><b>${flag(p.nat)}${esc(p.name)}</b><small>${[p.birth ? age(p.birth) + "歳" : "", p.memo].filter(Boolean).map(esc).join("　") || "&nbsp;"}</small></div></a>`;
}
const ROLE_EN = { 監督: "MANAGER", ヘッドコーチ: "HEAD COACH", コーチ: "COACH", GKコーチ: "GK COACH", フィジカルコーチ: "FITNESS COACH", アナリスト: "ANALYST", ユース監督: "ACADEMY MANAGER" };
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
const staffBlock = () => { const S = staffList(); return S.length ? sec("STAFF", "監督・コーチ") + `<div class="pgrid">${S.map(staffCard).join("")}</div>` : ""; };
function identity() {
  const sq = D.players.filter(p => !/退団/.test(p.status)), me = clubName();
  const jp = sq.filter(isJP).length;
  /* アカデミー出身：ユース昇格の記録か、U-12〜U-18のどれかが自クラブ */
  const ac = sq.filter(p => isYouth(p) || (p.schools || []).some(x => isOwn(x[1]))).length;
  const sign = D.trans.filter(t => /^(加入|レンタル加入)$/.test(t.kind)).length;
  const ages = sq.map(p => p.birth ? age(p.birth) : null).filter(a => a != null);
  const avg = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "-";
  const pc = n => sq.length ? Math.round(n / sq.length * 100) : 100;
  return `<section class="ident"><div class="ident-in"><div class="ident-g">
    <div><b>${pc(jp)}<small>%</small></b><span>JAPANESE</span><em>日本人選手</em></div>
    <div><b>${pc(ac)}<small>%</small></b><span>ACADEMY</span><em>アカデミー出身</em></div>
    <div><b>${sign}</b><span>SIGNINGS</span><em>補強</em></div>
    <div><b>${avg}<small>歳</small></b><span>AVERAGE AGE</span><em>平均年齢</em></div></div></div></section>`;
}
const pLink = (name, inner) => `<a href="#/player/${encodeURIComponent(name)}">${inner || esc(name)}</a>`;

/* ---------- 評価バッジ ---------- */
/* 途中出場は、交代で下がった選手のポジションで出場したとみなす（連続交代もたどる） */
function playedPos(m, l, depth = 0) {
  if (!l || l.role === "先発" || depth > 5) return l ? l.pos : "";
  const e = (m.ev || []).find(e => e.kind === "交代" && e.side === l.side && same(e.player, l.name));
  const out = e && e.rel ? m.lu.find(x => x.side === l.side && same(x.name, e.rel)) : null;
  return out ? playedPos(m, out, depth + 1) || l.pos : l.pos;
}
function rtCls(r) { return r == null ? "r0" : r >= 9 ? "r9" : r >= 8 ? "r8" : r >= 7 ? "r7" : r >= 6 ? "r6" : "r5"; }
const rt = r => r == null ? "" : `<span class="rt ${rtCls(r)}">${fmtN(r, 1)}</span>`;
const wdl = m => `<span class="wdl ${m.res}" aria-label="${{ W: "勝ち", D: "引き分け", L: "負け" }[m.res]}">${{ W: "W", D: "D", L: "L" }[m.res]}</span>`;
const scoreTxt = m => m.ha === "A" ? `${m.ga} - ${m.gf}` : `${m.gf} - ${m.ga}`;
const homeAway = m => m.ha === "A" ? { home: m.opp, away: clubName(), hs: "opp", as: "me" } : { home: clubName(), away: m.opp, hs: "me", as: "opp" };
const roundTxt = m => [m.comp, m.round].filter(Boolean).join(" ");
/* 画面表示用：大会名と節を2行に分ける */
const roundBr = m => `<span class="rb"><span>${esc(m.comp || "")}</span>${m.round ? `<span>${esc(m.round)}</span>` : ""}</span>`;

/* =====================================================================
   集計
   ===================================================================== */
const ofSeason = s => D.played.filter(m => !s || m.season === s);
function record(L) {
  const r = { n: L.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0 };
  L.forEach(m => { r[m.res === "W" ? "w" : m.res === "L" ? "l" : "d"]++; r.gf += m.gf; r.ga += m.ga; if (m.ga === 0) r.cs++; });
  r.pts = r.w * 3 + r.d; return r;
}
/* 選手ごとの集計 */
function playerAgg(L) {
  const P = {};
  const get = n => P[nameKey(n)] || (P[nameKey(n)] = { name: n, apps: 0, starts: 0, min: 0, g: 0, a: 0, rSum: 0, rN: 0, mom: 0, cs: 0, yc: 0, rc: 0, s: {}, has: {}, list: [] });
  L.forEach(m => {
    if (m.lu.length) {
      m.lu.forEach(l => {
        const p = get(l.name); p.apps++; if (l.role === "先発") p.starts++;
        p.min += l.s["出場時間"] ?? 0; p.list.push({ m, l });
        if (l.rating != null) { p.rSum += l.rating; p.rN++; }
        Object.keys(l.s).forEach(k => { p.s[k] = (p.s[k] || 0) + l.s[k]; p.has[k] = true; });
        if (/GK/.test(l.pos) && l.role === "先発" && m.ga === 0) p.cs++;
        if (!p.pos && l.pos) p.pos = l.pos;
      });
      const sc = {}, as = {};
      m.scorers.forEach(x => sc[nameKey(x.name)] = (sc[nameKey(x.name)] || 0) + x.n);
      m.assists.forEach(x => as[nameKey(x.name)] = (as[nameKey(x.name)] || 0) + x.n);
      /* 得点・アシストは試合シート優先（出場選手シートと食い違ったとき） */
      Object.keys(sc).forEach(k => { if (!P[k]) get(m.scorers.find(x => nameKey(x.name) === k).name); });
      Object.keys(as).forEach(k => { if (!P[k]) get(m.assists.find(x => nameKey(x.name) === k).name); });
      m._sc = sc; m._as = as;
    } else {
      m.scorers.forEach(x => { if (!/オウン/.test(x.name)) get(x.name); });
      m.assists.forEach(x => get(x.name));
    }
  });
  Object.values(P).forEach(p => {
    const k = nameKey(p.name);
    p.g = 0; p.a = 0;
    L.forEach(m => {
      p.g += sum(m.scorers.filter(x => nameKey(x.name) === k), x => x.n);
      p.a += sum(m.assists.filter(x => nameKey(x.name) === k), x => x.n);
      if (m.mom && nameKey(m.mom) === k) p.mom++;
    });
    p.yc = p.s["警告"] || 0; p.rc = p.s["退場"] || 0;
    p.rating = p.rN ? p.rSum / p.rN : null;
    const pr = prof(p.name); if (pr && pr.pos) p.pos = pr.pos;
  });
  return Object.values(P).filter(p => !/オウン/.test(p.name));
}
/* チームの値（チームスタッツ → 無ければ自分は出場選手の合計） */
function tv(m, side, k) {
  const t = m.ts[side]; if (t && t[k] != null) return t[k];
  if (side === "me" && LU_SUMMABLE.has(k) && m.lu.some(l => l.s[k] != null)) return sum(m.lu, l => l.s[k]);
  if (k === "パス成功率") { const a = tv(m, side, "パス成功"), b = tv(m, side, "パス"); return a != null && b ? a / b * 100 : null; }
  if (k === "タックル成功率") { const a = tv(m, side, "タックル成功"), b = tv(m, side, "タックル"); return a != null && b ? a / b * 100 : null; }
  if (k === "ドリブル成功率") { const a = tv(m, side, "ドリブル成功"), b = tv(m, side, "ドリブル"); return a != null && b ? a / b * 100 : null; }
  return null;
}
function teamAvg(L, side, k) { const v = L.map(m => tv(m, side, k)).filter(x => x != null); return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, tot: v.reduce((a, b) => a + b, 0), n: v.length } : null; }
function ratio(L, side, a, b) { let x = 0, y = 0; L.forEach(m => { const p = tv(m, side, a), q = tv(m, side, b); if (p != null && q) { x += p; y += q; } }); return y ? x / y * 100 : null; }

/* ランキングの項目（FotMob の「選手スタッツ」） */
const PM = [
  { k: "得点", f: p => p.g, u: "", d: 0 },
  { k: "アシスト", f: p => p.a, u: "", d: 0 },
  { k: "得点+アシスト", f: p => p.g + p.a, u: "", d: 0 },
  { k: "平均評価", f: p => p.rating, u: "", d: 2, base: p => p.rN, rating: true },
  { k: "MOM", f: p => p.mom, u: "回", d: 0 },
  { k: "出場", f: p => p.apps, u: "試合", d: 0 },
  { k: "出場時間", f: p => p.has["出場時間"] ? p.min : null, u: "分", d: 0 },
  { k: "シュート", f: p => p.s["シュート"], u: "", d: 0 },
  { k: "枠内シュート", f: p => p.s["枠内シュート"], u: "", d: 0 },
  { k: "キーパス", f: p => p.s["キーパス"], u: "", d: 0 },
  { k: "パス成功率", f: p => p.s["パス"] ? p.s["パス成功"] / p.s["パス"] * 100 : null, u: "%", d: 1, base: p => p.s["パス"] },
  { k: "ドリブル成功", f: p => p.s["ドリブル成功"], u: "", d: 0 },
  { k: "タックル成功", f: p => p.s["タックル成功"], u: "", d: 0 },
  { k: "インターセプト", f: p => p.s["インターセプト"], u: "", d: 0 },
  { k: "クリア", f: p => p.s["クリア"], u: "", d: 0 },
  { k: "セーブ", f: p => p.s["セーブ"], u: "", d: 0 },
  { k: "クリーンシート", f: p => p.cs, u: "", d: 0 },
  { k: "走行距離", f: p => p.s["走行距離"], u: "km", d: 1 },
  { k: "警告", f: p => p.yc, u: "", d: 0 },
  { k: "退場", f: p => p.rc, u: "", d: 0 }
];
/* 90分あたり（出場時間が最多の選手の30%以上かつ90分以上の選手が対象） */
const p90f = f => p => { const v = f(p); return v != null && p.min >= 90 ? v / p.min * 90 : null; };
const PM90 = [["得点", p => p.g], ["アシスト", p => p.a], ["得点+アシスト", p => p.g + p.a], ["ゴール期待値", p => p.s["ゴール期待値"]], ["シュート", p => p.s["シュート"]], ["枠内シュート", p => p.s["枠内シュート"]],
  ["キーパス", p => p.s["キーパス"]], ["パス成功", p => p.s["パス成功"]], ["ドリブル成功", p => p.s["ドリブル成功"]], ["タックル成功", p => p.s["タックル成功"]], ["インターセプト", p => p.s["インターセプト"]],
  ["ブロック", p => p.s["ブロック"]], ["クリア", p => p.s["クリア"]], ["セーブ", p => p.s["セーブ"]], ["走行距離", p => p.s["走行距離"], "km"]]
  .map(([k, f, u]) => ({ k, f: p90f(f), u: u || "", d: 2, base: p => p.min }));
function ranked(P, M) {
  let R = P.map(p => ({ p, v: M.f(p) })).filter(x => x.v != null && x.v !== 0 && isFinite(x.v));
  if (M.base) { const mx = Math.max(0, ...P.map(p => M.base(p) || 0)); const need = Math.max(1, mx * 0.3); R = R.filter(x => (M.base(x.p) || 0) >= need); }
  return R.sort((a, b) => b.v - a.v || (b.p.apps - a.p.apps));
}

/* チームスタッツ（FotMob の「チームスタッツ」） */
function teamMetrics(L) {
  const r = record(L), out = [];
  const add = (g, k, v, u, d, sub) => { if (v != null && isFinite(v)) out.push({ g, k, v, u, d, sub }); };
  const avg = (k, side = "me") => teamAvg(L, side, k);
  if (r.n) {
    add("概要", "1試合平均得点", r.gf / r.n, "", 2, `合計 ${r.gf}`);
    add("概要", "1試合平均失点", r.ga / r.n, "", 2, `合計 ${r.ga}`);
    add("概要", "クリーンシート", r.cs, "", 0, `${fmtN(r.cs / r.n * 100, 0)}%の試合`);
    add("概要", "勝率", r.w / r.n * 100, "%", 1, `${r.w}勝${r.d}分${r.l}敗`);
  }
  const po = avg("ボール支配率"); if (po) add("概要", "平均ボール支配率", po.avg, "%", 1, `${po.n}試合`);
  const xg = avg("ゴール期待値"); if (xg) add("攻撃", "1試合平均ゴール期待値", xg.avg, "", 2, `合計 ${fmtN(xg.tot, 1)}`);
  const sh = avg("シュート"); if (sh) add("攻撃", "1試合平均シュート", sh.avg, "", 1, `合計 ${fmtN(sh.tot)}`);
  const on = ratio(L, "me", "枠内シュート", "シュート"); add("攻撃", "枠内シュート率", on, "%", 1);
  if (sh && sh.tot) { const g = sum(L.filter(m => tv(m, "me", "シュート") != null), m => m.gf); add("攻撃", "シュート決定率", g / sh.tot * 100, "%", 1); }
  if (xg) { const g = sum(L.filter(m => tv(m, "me", "ゴール期待値") != null), m => m.gf); add("攻撃", "得点 − ゴール期待値", g - xg.tot, "", 1); }
  const bc = avg("ペナルティエリア内シュート") || avg("ボックス内シュート"); if (bc) add("攻撃", "1試合平均ペナルティエリア内シュート", bc.avg, "", 1);
  const bo = avg("ペナルティエリア外シュート"); if (bo) add("攻撃", "1試合平均ペナルティエリア外シュート", bo.avg, "", 1);
  const ck = avg("コーナーキック"); if (ck) add("攻撃", "1試合平均コーナーキック", ck.avg, "", 1);
  const ps = avg("パス"); if (ps) add("パス", "1試合平均パス", ps.avg, "", 0);
  add("パス", "パス成功率", ratio(L, "me", "パス成功", "パス"), "%", 1);
  const kp = avg("キーパス"); if (kp) add("パス", "1試合平均キーパス", kp.avg, "", 1);
  const cr = avg("クロス"); if (cr) add("パス", "1試合平均クロス", cr.avg, "", 1);
  const tp = avg("スルーパス"); if (tp) add("パス", "1試合平均スルーパス", tp.avg, "", 1);
  add("パス", "ドリブル成功率", ratio(L, "me", "ドリブル成功", "ドリブル"), "%", 1);
  const xga = avg("ゴール期待値", "opp"); if (xga) add("守備", "1試合平均被ゴール期待値", xga.avg, "", 2);
  const sha = avg("シュート", "opp"); if (sha) add("守備", "1試合平均被シュート", sha.avg, "", 1);
  const rt_ = avg("ボール奪取時間"); if (rt_) add("守備", "平均ボール奪取時間", rt_.avg, "秒", 1);
  const tk = avg("タックル"); if (tk) add("守備", "1試合平均タックル", tk.avg, "", 1);
  add("守備", "タックル成功率", ratio(L, "me", "タックル成功", "タックル"), "%", 1);
  const ic = avg("インターセプト"); if (ic) add("守備", "1試合平均インターセプト", ic.avg, "", 1);
  const cl = avg("クリア"); if (cl) add("守備", "1試合平均クリア", cl.avg, "", 1);
  const sv = avg("セーブ"); if (sv) add("守備", "1試合平均セーブ", sv.avg, "", 1);
  const fo = avg("ファウル"); if (fo) add("規律", "1試合平均ファウル", fo.avg, "", 1);
  const yc = avg("警告"); if (yc) add("規律", "警告", yc.tot, "枚", 0);
  const rc = avg("退場"); if (rc) add("規律", "退場", rc.tot, "回", 0);
  const of = avg("オフサイド"); if (of) add("規律", "1試合平均オフサイド", of.avg, "", 1);
  return out;
}

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

/* =====================================================================
   パーツ
   ===================================================================== */
const WDE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ICON = {
  ball: `<img class="ico-ball" src="images/icon/ball.png" alt="" aria-hidden="true">`,
  sub: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.4" aria-hidden="true"><path d="M7 20V5M3 9l4-4 4 4" stroke="#1d9a55"/><path d="M17 4v15M13 15l4 4 4-4" stroke="#d6404a"/></svg>`,
  cup: `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/></svg>`
};
const dotD = d => d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : "--.--";
const dotY = d => d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : "";
const seasonSel = () => `<label class="ssel"><span>SEASON</span><select id="season" aria-label="シーズン">${D.seasonList.map(s => `<option value="${esc(s)}"${s === ST.season ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>`;
const band = (en, jp, withSeason) => `<section class="band"><div class="band-in"><div><h1>${esc(en)}</h1><p>${esc(jp)}</p></div>${withSeason ? seasonSel() : ""}</div></section>`;
const sec = (en, jp, link, linkTxt) => `<h2 class="sec"><b>${esc(en)}</b><small>${esc(jp)}</small>${link ? `<a href="${link}">${esc(linkTxt || "VIEW ALL")}</a>` : ""}</h2>`;
const kickoff = m => { if (m.kick) return m.kick; const t = half(m.memo).match(/(\d{1,2}:\d{2})/); return t ? t[1] : ""; };
/* 天気のアイコン */
const WX = {
  晴れ: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>`,
  曇り: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/></svg>`,
  雨: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></svg>`,
  雪: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/></svg>` };
const venue = m => m.stadium || (m.ha === "H" ? D.conf["ホームスタジアム"] : "") || "";

/* 大会のエンブレム（images/comp/大会名.png）。なければ何も出さない */
const compLogo = (c, cls) => c ? `<img class="clogo ${cls || ""}" src="${esc(imgSrc(`images/comp/${String(c).trim()}.png`))}" alt="" loading="lazy" onerror="this.remove()">` : "";
function matchRow(m) {
  const right = m.played ? `<span class="res ${m.res}">${m.gf}-${m.ga}</span>${m.pk ? `<span class="pk">PK ${m.pk.a}-${m.pk.b}</span>` : ""}`
    : `<span class="up">${kickoff(m) || ""}</span>`;
  return `<a class="mrow" href="#/match/${m.id}">
    <div class="d"><b>${dotD(m.date)}</b><span>${m.date ? WDE[m.date.getDay()] : ""}</span></div>
    <div class="t">${logo(m.opp, "md")}<div><small class="mr-meta"><span class="ha ${m.ha}">${m.ha === "H" ? "HOME" : m.ha === "A" ? "AWAY" : ""}</span>${compLogo(m.comp, "sm")}<span class="mr-comp">${roundBr(m)}</span></small><b>${clubName2(m.opp)}</b></div></div>
    <div class="s">${right}</div></a>`;
}
function standing(season, comp, mini) {
  const comps = [...new Set(D.table.filter(r => r.season === season).map(r => r.comp))];
  const c = comp && comps.includes(comp) ? comp : comps[0];
  const T = D.table.filter(r => r.season === season && r.comp === c).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (!T.length) return null;
  let rows = T;
  if (mini) { const i = T.findIndex(r => isMe(r.club)); const a = Math.max(0, Math.min(T.length - 6, i - 2)); rows = i < 0 ? T.slice(0, 6) : T.slice(a, a + 6); }
  const gd = r => r.gf != null && r.ga != null ? (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga) : "";
  return { comp: c, comps, html: `<div class="tw"><table class="t"><thead><tr><th class="pos">順位</th><th class="l">クラブ</th><th>試合</th>${mini ? "" : `<th class="sx">勝</th><th class="sx">分</th><th class="sx">負</th><th class="sx">得点</th><th class="sx">失点</th>`}<th>得失差</th><th>勝点</th>${!mini && T.some(r => r.form && r.form.length) ? "<th class=\"fm\">直近5試合</th>" : ""}</tr></thead><tbody>
    ${rows.map(r => `<tr class="${isMe(r.club) ? "me" : ""}"><td class="pos">${r.rank ?? ""}</td><td class="club l"><div>${logo(r.club, "sm")}<span>${clubName2(r.club)}</span></div></td><td>${r.p ?? ""}</td>
      ${mini ? "" : `<td class="sx">${r.w ?? ""}</td><td class="sx">${r.d ?? ""}</td><td class="sx">${r.l ?? ""}</td><td class="sx">${r.gf ?? ""}</td><td class="sx">${r.ga ?? ""}</td>`}<td>${gd(r)}</td><td><b>${r.pts ?? ""}</b></td>${!mini && T.some(r => r.form && r.form.length) ? `<td class="fm"><span class="form5">${(r.form || []).map(x => `<span class="wdl ${x}">${x}</span>`).join("")}</span></td>` : ""}</tr>`).join("")}</tbody></table></div>` };
}
function rkCard(M, P, label) {
  const R = ranked(P, M); if (!R.length) return "";
  const f = R[0], v = x => fmtN(x, M.d) + (M.u === "%" ? "%" : "");
  return `<div class="rk-card"><a class="rk-top" href="#/player/${encodeURIComponent(f.p.name)}"><div class="who"><h3>${esc(label || M.k)}</h3><b>${esc(f.p.name)}</b><small>${esc(f.p.pos || "")}</small></div>
      ${face(f.p.name)}<div class="big${v(f.v).length >= 5 ? " l5" : v(f.v).length >= 4 ? " l4" : ""}">${v(f.v)}</div></a>
    ${R.slice(1).map((x, i) => `<a class="rk-row${i >= 4 ? " more" : i >= 2 ? " m-more" : ""}" href="#/player/${encodeURIComponent(x.p.name)}"><span class="n">${i + 2}</span><span class="nm">${esc(x.p.name)}</span><span class="val">${v(x.v)}</span></a>`).join("")}
    ${R.length > 3 ? `<button type="button" class="all${R.length > 5 ? "" : " m-only"}" onclick="const c=this.parentNode;c.classList.toggle('open');this.textContent=c.classList.contains('open')?'閉じる':'ランキングを見る（${R.length}人）'">ランキングを見る（${R.length}人）</button>` : ""}</div>`;
}
const seasonLabel = s => s || "";

/* ---------- ニュース（試合・移籍から自動で作る） ---------- */
const MON_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const NCAT = { CLUB: "クラブ", PREVIEW: "試合情報", RESULT: "試合結果", TRANSFER: "移籍", CONTRACT: "契約更新", ACADEMY: "アカデミー", MEDICAL: "メディカル", TITLE: "タイトル", AWARD: "表彰", RECORD: "記録", FIRST: "初記録" };
/* 表示用のカテゴリー（n.cat は並び順などの判定用にそのまま使う） */
const ncat = n => n.cat === "MATCH" ? (n.kind === "result" ? "RESULT" : "PREVIEW")
  : n.cat === "TRANSFER" ? (n.tr && n.tr.kind === "契約延長" ? "CONTRACT" : n.tr && n.tr.kind === "ユース昇格" ? "ACADEMY" : "TRANSFER")
  : n.cat === "RECORD" ? (n.ms && n.ms.firsts ? "FIRST" : n.ms && /^(MOM|TOTW|MONTHLY MVP|AWARD)$/.test(n.ms.en || "") ? "AWARD" : n.ms && n.ms.en === "CHAMPIONS" ? "TITLE" : "RECORD")
  : n.inj ? "MEDICAL" : n.title ? "TITLE" : "CLUB";
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
        t: `${x.name}選手 ${nw ? "" : clubName() + "での"}通算${v}${MS_P[k].u}達成` }));
        if (nw && MS_P[k].first && p[k] === 0 && x[k] > 0) (x.fs = x.fs || []).push(k); p[k] += x[k]; });
      /* 初記録（デビュー・初ゴールなど）は1試合1選手で1件にまとめる */
      if (x.fs) { const ord = ["apps", "g", "a", "cs"].filter(k => x.fs.includes(k)), hd = ["g", "a", "cs", "apps"].find(k => x.fs.includes(k)), lab = ord.map(k => MS_P[k].first);
        const txt = `${x.name}選手が` + (ord[0] === "apps" ? `トップチームデビューを果たし${ord.length > 1 ? `、${lab.slice(1).join("・")}も記録しました` : "ました"}` : `${lab.join("・")}を記録しました`) + "。";
        N.push({ id: `r-first-${nameKey(x.name)}-${m.id}`, d: m.date, cat: "RECORD", m0: m, ms: { who: x.name, k: hd, v: 1, def: MS_P[hd], firsts: ord, txt }, t: `${x.name}選手 ${lab.join("・")}` }); } });
    const tx = { w: m.res === "W" ? 1 : 0, g: m.gf, n: 1, cs: m.ga === 0 ? 1 : 0 };
    Object.keys(MS_T).forEach(k => { hit(MS_T[k], T[k], T[k] + tx[k]).forEach(v => N.push({ id: `r-t${k}-${v}`, d: m.date, cat: "RECORD", m0: m, ms: { club: true, k, v, def: MS_T[k], pro: true },
      t: `${clubName()} 通算${v}${MS_T[k].u}達成` })); T[k] += tx[k]; });
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
    const mg = m.gf - m.ga; if (m.res === "W" && mg >= 4 && bigM > 0 && mg > bigM) push(m, `r-big-${m.id}`, `${clubName()} 史上最多得点差の勝利`, { club: true, big: `+${mg}`, en: "RECORD WIN", txt: `${clubName()}は${m.gf}-${m.ga}で勝利し、${clubName()}史上最多得点差（${mg}点差）の勝利を記録しました。` });
    if (m.res === "W") bigM = Math.max(bigM, mg);
    /* 連敗ストップ */
    if (m.res === "L") lose++; else { if (lose >= 4) push(m, `r-ls-${m.id}`, `${clubName()} 連敗を${lose}でストップ`, { club: true, big: lose, en: "STREAK ENDED", txt: `${clubName()}は${m.res === "W" ? "勝利" : "引き分け"}で、連敗を${lose}で止めました。` }); lose = 0; }
    /* 1シーズンのクラブ記録（ゴール・アシスト）。過去のシーズンの記録を超えたとき1回だけ */
    if (m.season !== curSe) { Object.values(cur).forEach(p => { best.g = Math.max(best.g, p.g); best.a = Math.max(best.a, p.a); }); Object.keys(cur).forEach(k => delete cur[k]); curSe = m.season; }
    [["g", m.scorers, "ゴール"], ["a", m.assists, "アシスト"]].forEach(([k, L, u]) => L.forEach(x => { if (/オウン/.test(x.name)) return; const key = nameKey(x.name), p = cur[key] || (cur[key] = { g: 0, a: 0, done: {} });
      p[k] += x.n; if (best[k] > 0 && p[k] > best[k] && !p.done[k]) { p.done[k] = 1; push(m, `r-sr-${k}-${m.season}-${key}`, `${x.name}選手 クラブのシーズン最多${u}記録を更新`, { who: x.name, big: p[k], en: k === "g" ? "GOALS" : "ASSISTS", txt: `${x.name}選手が今シーズン${p[k]}${u}目を記録し、クラブの1シーズン最多${u}記録（${best[k]}）を更新しました。` }); } }));
  });
  /* TOTW（チーム・オブ・ザ・ウィーク）選出。自チームの選手のみ、1試合で1記事、試合の5日後に発表 */
  const TW = {};
  D.played.forEach(m => { const L = m.lu.filter(l => l.totw); if (!L.length) return;
    const d = m.date, when = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）の${esc(roundTxt(m))} ${esc(m.opp)}戦`;
    const P = L.map(l => { const k = nameKey(l.name); TW[k] = (TW[k] || 0) + 1; return { name: l.name, pos: l.pos, rating: l.rating, ovr: l.rating != null ? Math.round(l.rating * 10) : null, c: TW[k], g: l.s["得点"] || 0, a: l.s["アシスト"] || 0 }; });
    const t = P.length === 1 ? `${P[0].name}選手 TOTWに選出` : P.length === 2 ? `${P[0].name}選手・${P[1].name}選手 TOTWに選出` : `TOTWに${P.length}選手が選出`;
    const li = P.map(x => `<li><span>${esc(x.pos || "")}</span><b><a href="#/player/${encodeURIComponent(x.name)}">${esc(x.name)}</a></b></li>`).join("");
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
    push(last, `r-mvp-${k}`, `${top.name}選手 ${mo}月のクラブ月間MVPに選出`, { who: top.name, en: "MONTHLY MVP", club_mvp: mo,
      html: `<p>${esc(clubName())}の${mo}月のクラブ月間MVPに、${esc(top.name)}選手が選ばれました。${mo}月は${st}しました。</p><p class="nbtn"><a class="btn" href="#/player/${encodeURIComponent(top.name)}">PLAYER PROFILE</a></p>` }); });
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
    if (me && me.rank === 1) push(last, `r-ch-${se}`, `${lg} 優勝のお知らせ`, { club: true, big: "", en: "CHAMPIONS", html: `<p>${esc(clubName())}は、${esc(se)}シーズンの${esc(lg)}で優勝しました（${me.w}勝${me.d}分${me.l}敗・勝点${me.pts}）。</p><p class="nbtn"><a class="btn" href="#/table">STANDINGS</a></p>` });
    if (mv) push(last, `r-mv-${se}`, mv === "up" ? `${nlg}への昇格が決定` : `${nlg}への降格が決定`, { club: true, big: "", en: mv === "up" ? "PROMOTED" : "RELEGATED",
      html: `<p>${esc(clubName())}は、${esc(se)}シーズンの${esc(lg)}を${me ? me.rank + "位" : ""}で終え、${esc(nx)}シーズンは${esc(nlg)}で戦うことが決まりました。</p><p class="nbtn"><a class="btn" href="#/table">STANDINGS</a></p>` });
    const li = (k, p, v) => p ? `<li><span>${k}</span><b>${esc(p.name)}</b>${v}</li>` : "";
    push(last, `r-ss-${se}`, `【${se}シーズン】シーズン終了のお知らせ`, { club: true, big: "", en: "SEASON REVIEW",
      html: `<p>${esc(clubName())}の${esc(se)}シーズンの全日程が終了しました。</p>
        <ul class="srev">${me ? `<li><span>${esc(lg)}</span><b>${me.rank}位</b>勝点${me.pts}</li>` : ""}<li><span>公式戦</span><b>${r.n}試合 ${r.w}勝${r.d}分${r.l}敗</b>得点${r.gf} 失点${r.ga}</li>
        ${li("チーム得点王", tg, `${ranked(P, PM[0])[0] ? ranked(P, PM[0])[0].v : ""}ゴール`)}${li("アシスト王", ta, `${ranked(P, PM[1])[0] ? ranked(P, PM[1])[0].v : ""}アシスト`)}${li("平均評価1位", tr, ranked(P, PM[3])[0] ? fmtN(ranked(P, PM[3])[0].v, 2) : "")}</ul>
        <p>応援ありがとうございました。</p><p class="nbtn"><a class="btn" href="#/stats">STATS</a></p>` }, last.date);
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
    if (ws) { const nr = win > rec.win && rec.win >= 3; push(m, `r-ws-${m.id}`, `${clubName()} ${nr ? "クラブ新記録の" : ""}${win}連勝`, { club: true, big: win, en: "WINS IN A ROW", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}${win}連勝を達成しました。` }); }
    if (!ws && unb >= 10 && unb % 5 === 0) { const nr = unb > rec.unb && rec.unb >= 10; push(m, `r-ub-${m.id}`, `${clubName()} ${nr ? "クラブ新記録の" : ""}${unb}試合無敗`, { club: true, big: unb, en: "UNBEATEN", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}公式戦${unb}試合無敗となりました。` }); }
    rec.win = Math.max(rec.win, win); rec.unb = Math.max(rec.unb, unb);
    /* クラブ最年少（デビュー・ゴール）。最初の記録は記事にしない */
    /* 1試合につき、その試合で一番若い選手だけを比べる（同じ試合で記録が何度も更新されないように） */
    const chk = (kind, names) => { let best = null;
      names.forEach(name => { const p = prof(name); if (!p || !p.birth || !m.date) return; const a = ageTxt(p.birth, m.date); if (!best || a.ms < best.a.ms) best = { name, a }; });
      if (!best) return; const { name, a } = best, cur = yng[kind];
      if (!cur || a.ms < cur) { if (cur) push(m, `r-yg-${kind}-${m.id}-${nameKey(name)}`, `${name}選手 ${clubName()}史上最年少${kind === "debut" ? "デビュー" : "ゴール"}`,
        { who: name, big: a.y, en: "YEARS OLD", sub: `${a.y}歳${a.days}日`, txt: `${name}選手が${a.y}歳${a.days}日で${kind === "debut" ? "トップチームデビュー" : "ゴール"}を記録し、${clubName()}史上最年少記録を更新しました。` });
        yng[kind] = a.ms; } };
    const deb = [];
    m.lu.filter(l => l.role !== "ベンチ").forEach(l => { const k = nameKey(l.name); if (!seen.has(k)) { seen.add(k); if (newcomer(l.name)) deb.push(l.name); } });
    chk("debut", deb);
    chk("goal", m.scorers.filter(x => !/オウン/.test(x.name)).map(x => x.name));
    /* MOM */
    if (m.mom && !(m.momL && m.momL.side === "opp")) { const k = nameKey(m.mom), c = (mom[k] = (mom[k] || 0) + 1);
      if (c === 5 || (c >= 10 && c % 10 === 0)) { const pp = newcomer(m.mom) ? "" : clubName() + "での"; push(m, `r-mom-${k}-${c}`, `${m.mom}選手 ${pp}通算${c}回目のMOM`, { who: m.mom, big: c, en: "MOM", txt: `${m.mom}選手が${pp}通算${c}回目のマン・オブ・ザ・マッチに選ばれました。` }); } }
  });
  return N;
}
function buildNews() {
  const N = [];
  D.played.forEach(m => N.push({ id: "m" + m.id, d: m.date, cat: "MATCH", m, kind: "result", t: `【試合結果】${roundTxt(m)} ${m.opp}戦` }));
  const nx = D.matches.find(m => !m.played), lp = D.played[D.played.length - 1];
  /* 試合情報：試合が終わっても記事は残す。発表日は前の試合の日（最初の試合は試合の7日前） */
  const MS = [...D.matches].filter(m => m.date).sort((a, b) => a.date - b.date);
  MS.forEach((m, i) => { if (!m.played && m !== nx) return; const pv = MS[i - 1], d = pv ? pv.date : new Date(m.date.getFullYear(), m.date.getMonth(), m.date.getDate() - 7);
    N.push({ id: "n" + m.id, d, cat: "MATCH", m, kind: "info", top: m === nx ? 1 : 0, t: `【試合情報】${roundTxt(m)} ${m.opp}戦` }); });
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
      html: `<p>${esc(a.name)}選手が、${esc(lg)}${lg ? "の" : ""}${mo}${esc(a.title)}に選ばれました。${a.memo ? esc(a.memo) : ""}</p><p class="nbtn"><a class="btn" href="#/player/${encodeURIComponent(a.name)}">PLAYER PROFILE</a></p>` },
      t: `${a.name}選手 ${lg ? lg + " " : ""}${a.title}${mon ? `（${mon}月）` : ""}に選出` }); });
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
  if (n.ms) { const s = n.ms, m0 = n.m0;
    /* 記録の画像：移籍・昇格と同じデザイン（大きい英字＋写真） */
    let lines, tag = m0 && m0.opp ? `VS ${shortOf(m0.opp)}` : "";
    const big = s.big !== "" && s.big != null ? String(s.big) : "";
    if (s.en === "HAT-TRICK") lines = ["HAT-", "TRICK"];
    else if (s.en === "MONTHLY MVP") { lines = s.club_mvp ? ["CLUB", "MVP"] : ["PLAYER OF", "THE MONTH"]; tag = s.club_mvp ? `${MON_EN[s.club_mvp - 1]}　CLUB AWARD` : s.tag || ""; }
    else if (s.en === "AWARD") { lines = ["AWARD"]; tag = s.tag || ""; }
    else if (s.en === "YEARS OLD") { lines = [big, "YEARS OLD"]; tag = "CLUB RECORD"; }
    else if (s.en) lines = big ? [big, s.en] : s.en.split(" ");
    else if (s.v === 1 && s.def.fe) lines = s.def.fe === "DEBUT" ? ["DEBUT"] : [s.def.fe.split(" ")[0], s.def.fe.split(" ").slice(1).join(" ")];
    else lines = [String(s.v), s.def.en];
    if (/クラブ新記録|シーズン最多|最多得点差/.test(n.t || "")) tag = "CLUB RECORD";
    const sz = t => t.length > 11 ? " s4" : t.length > 8 ? " s3" : t.length > 6 ? " s2" : "";
    const head = lines.filter(Boolean).map(t => `<b class="nx-h${sz(t)}">${esc(t)}</b>`).join("");
    const pr = s.club ? {} : prof(s.who) || {};
    return `<div class="nt nt-x nt-rec${s.club ? " is-club" : ""}"><div class="nx-bg">${logo(clubName(), "")}</div>${s.club ? `<div class="nx-crest">${logo(clubName(), "")}</div>` : face(s.who)}
      <div class="nx-t">${tag ? `<span class="nx-tag${tag === "CLUB RECORD" ? " gold" : ""}">${esc(tag)}</span>` : ""}${head}${s.club ? "" : `<span class="nx-n">${esc(pr.roma || s.who)}</span>${pr.roma ? `<span class="nx-j">${esc(s.who)}</span>` : ""}`}<span class="nx-c">${logo(clubName(), "")}${esc(clubName())}</span></div></div>`; }
  if (n.m) { const h = homeAway(n.m);
    const res = n.kind === "result";
    return `<div class="nt nt-m2"><div class="nm-top">${compLogo(n.m.comp, "nm-cl")}${roundBr(n.m)}</div>
      <div class="nm-t">${logo(h.home, "")}<b>${esc(shortOf(h.home))}</b></div>
      <div class="nm-c"><div class="nm-s">${res ? scoreTxt(n.m) : "VS"}</div><small>${res ? "FULL TIME" : dotY(n.m.date)}</small></div>
      <div class="nm-t">${logo(h.away, "")}<b>${esc(shortOf(h.away))}</b></div></div>`; }
  if (n.rename) return `<div class="nt nt-rn"><div class="rn-c">${logo(oldName(), "")}<span>${esc(oldName())}</span></div><i class="rn-ar"></i><div class="rn-c">${logo(clubName(), "")}<span>${esc(clubName())}</span></div><b class="rn-h">NEW ERA</b></div>`;
  if (n.inj) { const x = n.inj, pr = prof(x.name) || {};
    return `<div class="nt nt-x is-inj"><div class="nx-bg">${logo(clubName(), "")}</div>${face(x.name)}
      <div class="nx-t"><span class="nx-tag">MEDICAL UPDATE</span><b class="nx-h">INJURY</b><span class="nx-n">${esc(pr.roma || x.name)}</span>${pr.roma ? `<span class="nx-j">${esc(x.name)}</span>` : ""}<span class="nx-c">${logo(clubName(), "")}${esc(clubName())}</span></div></div>`; }
  if (n.tr) { const t = n.tr, pr = prof(t.name) || {};
    const w = { 加入: "WELCOME", レンタル加入: "WELCOME", ユース昇格: "PROMOTED", レンタル復帰: "RETURN", 退団: "THANK YOU", レンタル移籍: "ON LOAN", 契約延長: "RENEWED" }[t.kind] || "NEWS";
    const tag = t.kind === "ユース昇格" ? `ACADEMY${n.yno ? " #" + n.yno : ""}` : t.kind === "契約延長" && t.years ? `+${t.years} YEAR${t.years > 1 ? "S" : ""}` : t.kind === "レンタル移籍" && t.club ? `→ ${t.club}` : "";
    return `<div class="nt nt-x${t.kind === "ユース昇格" ? " is-acad" : t.kind === "退団" ? " is-out" : ""}"><div class="nx-bg">${logo(clubName(), "")}</div>${face(t.name)}
      <div class="nx-t">${tag ? `<span class="nx-tag">${esc(tag)}</span>` : ""}<b class="nx-h">${w}</b><span class="nx-n">${esc(pr.roma || t.name)}</span>${pr.roma ? `<span class="nx-j">${esc(t.name)}</span>` : ""}<span class="nx-c">${logo(clubName(), "")}${esc(clubName())}</span></div></div>`; }
  return `<div class="nt nt-c2">${ICON.cup}<div class="nt-w">CHAMPIONS<small>${esc(n.title || "")}</small></div></div>`;
}
const newsCard = n => `<a class="ncard" href="#/news/${encodeURIComponent(n.id)}">${newsThumb(n)}<div class="nb"><div class="nmeta"><time>${dotY(n.d)}</time>${catTag(n)}</div><b>${esc(n.t)}</b></div></a>`;
const newsList = L => `<div class="news">${L.map(n => `<a href="#/news/${encodeURIComponent(n.id)}"><time>${dotY(n.d)}</time>${catTag(n)}<b>${esc(n.t)}</b></a>`).join("")}</div>`;
function newsBody(n) {
  const P = s => `<p>${s}</p>`;
  if (n.ms && n.ms.html) return n.ms.html;
  if (n.ms) { const s = n.ms, m = n.m0, d = m.date, when = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）の${esc(roundTxt(m))} ${esc(m.opp)}戦`;
    const txt = s.txt ? `${when}で、${esc(s.txt)}` : s.club ? (s.v === 1 && s.def.first ? `${when}で、${esc(clubName())}は${s.def.first}を記録しました。` : `${when}で、${esc(clubName())}は${esc(oldName() ? "クラブ名変更後の" : "")}公式戦通算${s.v}${s.def.u}を達成しました。`)
      : (s.v === 1 && s.def.first ? `${when}で、${esc(s.who)}選手が${s.def.first}${s.k === "apps" ? "を果たしました" : "を記録しました"}。` : `${when}で、${esc(s.who)}選手が${s.pro ? esc(clubName()) + "での" : ""}公式戦通算${s.v}${s.def.u}を達成しました。`);
    return P(txt) + `<p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH REPORT</a>${s.club ? "" : ` <a class="btn" href="#/player/${encodeURIComponent(s.who)}">PLAYER PROFILE</a>`}</p>`; }
  if (n.m && n.kind === "result") { const m = n.m, d = m.date;
    const v = { W: "勝利しました", D: "引き分けました", L: "敗れました" }[m.res];
    let s = P(`${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）${venue(m) ? `に${esc(venue(m))}で` : "に"}行われた${esc(roundTxt(m))}で、${esc(clubName())}は${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk ? `（PK ${m.pk.a}-${m.pk.b}）` : ""}で${v}。`);
    if (m.scorers.length) s += P(`得点者：${m.scorers.map(x => esc(x.name) + (x.n > 1 ? `（${x.n}点）` : "")).join("、")}`);
    if (m.mom) s += P(`マン・オブ・ザ・マッチ：${esc(m.mom)}`);
    return s + `<p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH REPORT</a></p>`; }
  if (n.m) { const m = n.m, d = m.date, h = homeAway(m);
    const rows = [["大会", esc(roundTxt(m))], ["日時", `${d.getFullYear()}年${md(d)}（${WD[d.getDay()]}）${kickoff(m) ? "　" + kickoff(m) + " キックオフ" : ""}`],
      ["対戦カード", `${esc(h.home)} vs ${esc(h.away)}`], ["開催", m.ha === "H" ? "ホーム" : m.ha === "A" ? "アウェイ" : "中立地"], venue(m) ? ["会場", esc(venue(m))] : null].filter(Boolean);
    return `<dl class="inj-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl><div class="art-pv">${headToHead(m)}</div><p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH INFO</a></p>`; }
  if (n.rename) { const d = n.d, st = D.conf["ホームスタジアム"], f = D.conf["創設年"];
    const rows = [["新クラブ名", esc(clubName())], ["旧クラブ名", esc(oldName())], ["変更日", `${d.getFullYear()}年${md(d)}`], f ? ["設立", `${esc(f)}年`] : null, st ? ["ホームスタジアム", esc(st)] : null].filter(Boolean);
    return P(`このたび、${esc(oldName())}は新たなオーナーグループによる買収が完了し、新体制のもとで歩みを始めることとなりました。これにともない、${d.getFullYear()}年${md(d)}付でクラブ名を「${esc(clubName())}」に変更いたしましたので、お知らせいたします。`)
      + P(`${esc(oldName())}のアカデミーとトップチームは、そのまま${esc(clubName())}に引き継がれます。これまで${esc(oldName())}を支えてくださった皆さまに心より感謝申し上げるとともに、新しい${esc(clubName())}への変わらぬご声援をよろしくお願いいたします。`)
      + `<dl class="inj-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl><p class="nbtn"><a class="btn" href="#/club">CLUB</a></p>`; }
  if (n.inj) { const x = n.inj, m = D.played.find(q => dKey(q.date) === dKey(x.date)), d = x.date;
    const lead = m ? `${md(d)}（${WD[d.getDay()]}）に行われた${esc(roundTxt(m))} ${esc(m.opp)}戦で負傷した${esc(x.name)}選手について、検査の結果、下記のとおり診断されましたので、お知らせいたします。`
      : `${esc(x.name)}選手が負傷しましたので、お知らせいたします。`;
    const rows = [["負傷日", `${d.getFullYear()}年${md(d)}（${WD[d.getDay()]}）`], ["診断名", esc(x.what)], ["全治", [injTerm(x), x.back ? `（${md(x.back)}ごろ復帰予定）` : ""].join("")], ["復帰", x.ret ? `${md(x.ret)}に復帰しました` : ""]].filter(r => r[1]);
    return P(lead) + `<dl class="inj-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` + (x.memo ? P(esc(x.memo)) : "")
      + `<p class="nbtn">${m ? `<a class="btn" href="#/match/${m.id}">MATCH REPORT</a> ` : ""}<a class="btn" href="#/player/${encodeURIComponent(x.name)}">PLAYER PROFILE</a></p>`; }
  if (n.tr) { const t = n.tr, pr = prof(t.name) || {}, cl = t.club ? esc(t.club) + (leagueOf(t.club) ? `（${esc(leagueOf(t.club))}）` : "") : "";
    const ag = trAge(t);
    const who = `${esc(t.name)}選手${ag != null ? `（${ag}歳）` : ""}`;
    const tx = { ユース昇格: `${who}が、アカデミーからトップチームに昇格することが決まりましたので、お知らせいたします。`,
      退団: cl ? `${who}が、${cl}へ完全移籍することが決まりましたので、お知らせいたします。` : `${who}が退団することになりましたので、お知らせいたします。`,
      レンタル移籍: `${who}が、${cl || "他クラブ"}へ期限付き移籍することが決まりましたので、お知らせいたします。`,
      レンタル復帰: `期限付き移籍中の${who}が、${cl ? cl + "から" : ""}復帰することになりましたので、お知らせいたします。`,
      契約延長: t.years ? `${who}との契約を${t.years}年延長しましたので、お知らせいたします。` : `${who}と契約を更新しましたので、お知らせいたします。`, 加入: `${who}が加入することが決まりましたので、お知らせいたします。` }[t.kind] || `${who}について、${esc(t.kind)}のお知らせです。`;
    return P(tx) + (t.years && t.kind !== "契約延長" ? P(`契約期間は${t.years}年です。`) : "") + (n.yno ? P(`${esc(t.name)}選手は、${esc(clubName())}のアカデミーから${n.yno}人目のトップチーム昇格選手となります。`) : "") + (t.memo ? P(esc(t.memo)) : "")
      + newsProfile(t, pr) + `<p class="nbtn"><a class="btn" href="#/player/${encodeURIComponent(t.name)}">PLAYER PROFILE</a></p>`; }
  return P(`${esc(n.season)}シーズン、${esc(clubName())}は${esc(n.title)}で優勝しました。`) + `<p class="nbtn"><a class="btn" href="#/club">CLUB</a></p>`;
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

/* ---------- 試合カード（トップの GAME SCHEDULE） ---------- */
function gameCard(m, lab) {
  const h = homeAway(m), d = m.date;
  return `<div class="gcard${m.played ? "" : " up"}"><div class="g-lab">${lab}</div>
    <div class="g-comp">${roundBr(m)}</div>
    <div class="g-date"><b>${d ? `${d.getMonth() + 1}/${d.getDate()}` : ""}</b><span>${d ? WDE[d.getDay()] : ""}</span>${kickoff(m) ? `<em>${kickoff(m)}</em>` : ""}<span class="g-ha ${m.ha}">${m.ha === "H" ? "HOME" : m.ha === "A" ? "AWAY" : ""}</span></div>
    ${venue(m) ? `<div class="g-venue"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>${esc(venue(m))}</div>` : ""}
    <div class="g-vs"><div class="g-club">${logo(h.home, "lg")}<span>${esc(h.home)}</span></div>
      <div class="g-sc">${m.played ? `<b>${scoreTxt(m)}</b>${m.pk ? `<small>PK ${m.ha === "A" ? m.pk.b + "-" + m.pk.a : m.pk.a + "-" + m.pk.b}</small>` : ""}` : `<b class="vs">VS</b>`}</div>
      <div class="g-club">${logo(h.away, "lg")}<span>${esc(h.away)}</span></div></div>
    <div class="g-links">${m.played ? `<a href="#/match/${m.id}">試合詳細</a><a href="javascript:void 0" onclick="ST.mtab='stats';location.hash='#/match/${m.id}'">スタッツ</a><a href="javascript:void 0" onclick="ST.mtab='lineup';location.hash='#/match/${m.id}'">メンバー</a>`
      : `<a href="#/match/${m.id}">試合情報</a><a href="#/news/n${m.id}">プレビュー</a>`}</div></div>`;
}

/* =====================================================================
   ページ
   ===================================================================== */
function vHome() {
  const s = ST.cur, L = ofSeason(s), r = record(L);
  const upc = D.matches.filter(m => !m.played);
  const next = upc[0], lastM = L[L.length - 1] || D.played[D.played.length - 1];
  const P = playerAgg(L);
  const st = standing(s, null, true);
  const me = D.table.find(t => t.season === s && isMe(t.club));
  const nextHome = upc.find(m => m.ha === "H") || next;
  const kv = nextHome ? (() => { const h = homeAway(nextHome), d = nextHome.date; return `<section class="kv"><div class="kv-in">
      <div class="kv-txt">${D.conf["スローガン"] ? `<p class="kv-sl">${slogan(D.conf["スローガン"])}</p>` : ""}<p class="kv-lab">${nextHome.ha === "H" ? "NEXT HOME GAME" : "NEXT MATCH"}</p><p class="kv-comp">${roundBr(nextHome)}</p>
        <p class="kv-date"><b>${dotD(d)}</b><span>${d ? WDE[d.getDay()] : ""}</span>${kickoff(nextHome) ? `<em>${kickoff(nextHome)} KICK OFF</em>` : ""}</p>
        <p class="kv-venue">${esc(venue(nextHome) || "")}</p><a class="btn w" href="#/match/${nextHome.id}">MATCH INFO</a></div>
      <div class="kv-vs"><div>${logo(h.home, "xl")}<span>${esc(h.home)}</span></div><b>VS</b><div>${logo(h.away, "xl")}<span>${esc(h.away)}</span></div></div></div></section>`; })()
    : `<section class="kv kv-club"><div class="kv-in"><div class="hero-club">${logo(clubName(), "xl")}<div><p class="kv-lab">${esc(s)} SEASON</p><h1 class="hero-name">${esc(clubName())}</h1>${D.conf["スローガン"] ? `<p class="kv-sl" style="margin:12px 0 0">${slogan(D.conf["スローガン"])}</p>` : ""}</div></div></div></section>`;
  const cards = [lastM ? gameCard(lastM, "LATEST RESULT") : "", ...upc.slice(0, lastM ? 2 : 3).map((m, i) => gameCard(m, i === 0 ? "NEXT MATCH" : "UPCOMING"))].filter(Boolean);
  const news = buildNews();
  const tops = [[PM[0], "得点ランキング"], [PM[1], "アシストランキング"], [PM[3], "平均評価"]].map(([Mx, lb]) => rkCard(Mx, P, lb)).filter(Boolean);
  const asOf = L.length ? dotY(L[L.length - 1].date) : "";
  return `${kv}${D.err ? `<div class="wrap"><div class="err">${esc(D.err)}</div></div>` : ""}
  <section class="sch"><div class="wrap">${sec("GAME SCHEDULE", "試合日程")}
    ${cards.length ? `<div class="gcards">${cards.join("")}</div>` : `<div class="panel">${empty("試合日程はまだありません。")}</div>`}
    <div class="sch-btns"><a class="btn" href="#/matches">試合日程・結果一覧</a><a class="btn" href="#/table">順位表</a></div></div></section>
  <div class="wrap">
    ${sec("NEWS", "ニュース", "#/news", "MORE")}
    ${news.length ? `<div class="ngrid ng3">${news.slice(0, 6).map(newsCard).join("")}</div>` : `<div class="panel">${empty("ニュースはまだありません。")}</div>`}
    <div class="grid" style="margin-top:8px"><div>
      ${sec("STANDINGS", st ? st.comp : "順位表", "#/table", "MORE")}
      ${me ? `<div class="stc"><div class="stc-rk"><b>${me.rank}</b><small>位</small></div><div class="stc-r"><span>${me.p}試合</span><b>${me.w}勝 ${me.d}分 ${me.l}敗</b><span>勝点 <b>${me.pts}</b>　得失点差 ${me.gf - me.ga > 0 ? "+" : ""}${me.gf - me.ga}${asOf ? `　（${asOf} 時点）` : ""}</span></div></div>` : ""}
      ${st ? st.html : `<div class="panel">${empty("順位表はまだありません。")}</div>`}
    </div><div>
      ${sec("SEASON", s)}
      ${r.n ? `<div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="tile"><span>成績</span><b class="rec">${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div>
        <div class="tile"><span>直近5試合</span><b class="form5" style="margin-top:8px">${L.slice(-5).map(wdl).join("")}</b></div>
        <div class="tile"><span>得点</span><b>${r.gf}</b></div><div class="tile"><span>失点</span><b>${r.ga}</b></div></div>` : `<div class="panel">${empty("まだ試合がありません。")}</div>`}
    </div></div>
  </div>
  <div class="wrap">${tops.length ? sec("TOP PLAYERS", "チーム内ランキング", "#/stats", "MORE") + `<div class="sgrid sgrid3">${tops.join("")}</div>` : ""}</div>`;
}

function vNews(id) {
  if (id) return vNewsDetail(id);
  const all = buildNews(), cats = ["ALL", ...Object.keys(NCAT).filter(c => all.some(n => ncat(n) === c))];
  if (!cats.includes(ST.ncat)) ST.ncat = "ALL";
  const L = all.filter(n => ST.ncat === "ALL" || ncat(n) === ST.ncat);
  return band("NEWS", "ニュース") + `<div class="wrap">
    <div class="pills" id="ncat">${cats.map(c => `<button class="pill${c === ST.ncat ? " on" : ""}" data-c="${c}">${c === "ALL" ? "すべて" : NCAT[c]}</button>`).join("")}</div>
    ${L.length ? `<div class="ngrid">${L.slice(0, 60).map(newsCard).join("")}</div>` : `<div class="panel">${empty("ニュースはまだありません。")}</div>`}</div>`;
}
function bNews() { document.querySelectorAll("#ncat .pill").forEach(b => b.onclick = () => { ST.ncat = b.dataset.c; render(); }); }

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
function bStats() { document.querySelectorAll("#sview button").forEach(b => b.onclick = () => { ST.sview = b.dataset.v; render(); }); }
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
    ${kp.length ? `<div class="ph">KEY PLAYERS<small>注目選手</small></div><div class="kp">${kp.map(([lab, t, k, u]) => `<a class="kp-c" href="#/player/${encodeURIComponent(t.name)}">${face(t.name)}<div><span>${lab}</span><b>${esc(t.name)}</b><em>${t[k]}<small>${u}</small></em></div></a>`).join("")}</div>` : ""}
    ${ab.length ? `<div class="ph">ABSENCES<small>負傷で欠場予定の選手</small></div><div class="inj-ab">${ab.map(x => `<a href="#/player/${encodeURIComponent(x.name)}">${face(x.name)}<div><b>${esc(x.name)}</b><small>${esc(x.what || "負傷")}${x.back ? `・${md(x.back)}ごろ復帰予定` : ""}</small></div></a>`).join("")}</div>` : ""}`;
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
        ${top.length ? cell("この相手からの得点", top.map(t => `<a class="nw" href="#/player/${encodeURIComponent(t.name)}">${esc(t.name)}<small> ${t.n}点</small></a>`).join("、")) : ""}</div></div>
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
    const inner = `<div class="mom-ph">${face(m.mom)}</div><div class="mom-tx"><span>MAN OF THE MATCH</span><b>${esc(m.mom)}</b><small>${[l && l.no != null ? "#" + l.no : "", l ? l.pos : "", op ? m.opp : ""].filter(Boolean).map(esc).join("　")}</small></div>${l && l.rating != null ? `<div class="mom-rt"><small>RATING</small><b>${fmtN(l.rating, 1)}</b></div>` : ""}`;
    return op ? `<div class="mom">${inner}</div>` : `<a class="mom" href="#/player/${encodeURIComponent(m.mom)}">${inner}</a>`; })() : "";
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
      return op ? `<div class="${cls}">${inner}</div>` : `<a class="${cls}" href="#/player/${encodeURIComponent(x.l.name)}">${inner}</a>`; }).join("");
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
        return side === "me" ? `<a class="pr-row" href="#/player/${encodeURIComponent(l.name)}">${inner}</a>` : `<div class="pr-row">${inner}</div>`; }).join("")}</div>`; };
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
  const link = (l, inner, cls) => l.side !== "opp" ? `<a class="${cls}" href="#/player/${encodeURIComponent(l.name)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
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
    ROWS.forEach(row => { const c = row.filter(q => P.has(q) && !(q in WIDE)); c.forEach((q, i) => r[q] = (SPREAD[c.length] || SPREAD[4])[i]); });
    return r; })());
  const baseXY = pos => POSXY[pos] || POSXY[{ GK: "GK", DF: "CB", MF: "CM", FW: "ST" }[pos]] || [50, 50];
  /* 縦の位置：いるラインだけを等間隔に並べる（空いたラインで間延びしない） */
  const yMap = {};
  const lineY = side => yMap[side] || (yMap[side] = (() => {
    const ys = [...new Set(L(side).filter(l => l.role === "先発" && l.pos !== "GK").map(l => baseXY(l.pos)[1]))].sort((a, b) => a - b), g = [];
    ys.forEach(y => { const last = g[g.length - 1]; if (last && y - last.min <= 8) last.ys.push(y); else g.push({ min: y, ys: [y] }); });
    const r = {}; g.forEach((gr, i) => { const base = g.length > 1 ? 14 + i * 60 / (g.length - 1) : 44; gr.ys.forEach(y => r[y] = base + (y - gr.min) * 0.6); });
    return r; })());
  const posXY = (pos, side) => { const b = baseXY(pos), x = lineX(side)[pos];
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
    return band("STATS", M.k, true) + `<div class="wrap narrow"><div class="panel rank-full">${R.map((x, i) => `<a class="rk-row" href="#/player/${encodeURIComponent(x.p.name)}"><span class="n">${i + 1}</span>${face(x.p.name)}
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
    return `<a class="pcard${isLoan ? " loan" : ""}" href="#/player/${encodeURIComponent(p.name)}">
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
    ${out.length ? `<div id="sq-out" class="sq-anc"></div>` + sec("FORMER PLAYERS", "過去に在籍した選手") + `<div class="panel">${out.map(p => `<a class="prow" href="#/player/${encodeURIComponent(p.name)}"><span class="no"></span>${face(p.name)}<div class="nm"><b>${esc(p.name)}</b><small>${esc(p.pos)}</small></div></a>`).join("")}</div>` : ""}</div>`;
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
/* ---------- ヒストリー（シーズンごとの歩みとタイトル） ---------- */
function historySeasons() {
  const first = D.conf["最初のシーズン"] || "";
  const se = [...new Set([...D.seasons.map(x => x.season), ...D.seasonList])].filter(Boolean).sort();
  return se.map(k => {
    const x = D.seasons.find(y => y.season === k) || {}, lg = (k >= first && leagueOfSeason(k)) || x.league || "";
    const titles = String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean);
    const me = D.table.filter(r => r.season === k && isMe(r.club) && (!lg || r.comp === lg))[0];
    return { se: k, lg, t: tier(lg), titles, champ: titles.includes(lg), pro: first && k === first, efl: first && k >= first, rank: me && me.rank, cur: k === D.seasonList[0] && first && k >= first, memo: x.comment, fa: x.fa, cap: x.cap };
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
function vHistory() {
  const S = historySeasons(), first = D.conf["最初のシーズン"] || "";
  if (!S.length) return band("HISTORY", "ヒストリー") + `<div class="wrap">${empty("シーズンシートにリーグを入れると、ここに歩みが表示されます。")}</div>`;
  const T = S.map(o => o.t).filter(Boolean), up = (() => { let n = 0, b = 0; S.forEach((o, i) => { if (i && o.t && S[i - 1].t && o.t < S[i - 1].t) { n++; b = Math.max(b, n); } else if (i) n = 0; }); return b; })();
  const tc = {}; S.forEach(o => o.titles.forEach(t => (tc[t] = tc[t] || []).push(o.se)));
  const nL = S.reduce((a, o) => a + o.titles.filter(t => tier(t)).length, 0), nC = S.reduce((a, o) => a + o.titles.filter(t => !tier(t)).length, 0);
  const res = o => o.champ ? `<span class="hx-r win">${ICON.cup}リーグ優勝</span>` : o.cur ? `<span class="hx-r now">シーズン中</span>` : o.rank ? `<span class="hx-r">${o.rank}位</span>` : "";
  const node = o => { const cups = o.titles.filter(t => t !== o.lg);
    const rows = [cups.length ? ["カップ戦", cups.map(t => `<span class="hx-cup">${ICON.cup}${esc(t)}</span>`).join("")] : null,
      o.fa ? ["FAカップ", esc(o.fa) + (/優勝/.test(o.fa) ? "" : "進出")] : null,
      o.cap ? ["主将", `<a href="#/player/${encodeURIComponent(o.cap)}">${esc(o.cap)}</a>`] : null].filter(Boolean);
    return `<li class="hx${o.champ ? " champ" : ""}${o.pro ? " pro" : ""}${o.cur ? " cur" : ""}">
      <div class="hx-se">${esc(o.se)}</div><i class="hx-dot"></i>
      <div class="hx-card"><div class="hx-head"><b class="hx-t">${o.t || "-"}<small>部</small></b><div class="hx-lgw"><span class="hx-lg">${esc(o.lg)}</span>${res(o)}</div></div>
        ${o.pro ? `<p class="hx-pro">${oldName() ? `${esc(oldName())}から${esc(clubName())}へ。新体制で始動` : "EFL入り・プロクラブに"}</p>` : ""}
        ${rows.length ? `<dl class="hx-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}
        ${o.memo ? `<p class="hx-memo">${esc(o.memo)}</p>` : ""}</div></li>`; };
  return band("HISTORY", "ヒストリー") + `<div class="wrap">
    <div class="tiles hx-sum hx-2"><div class="tile"><span>リーグ優勝</span><b>${nL}<small>回</small></b></div><div class="tile"><span>カップ戦優勝</span><b>${nC}<small>回</small></b></div></div>
    ${sec("ROAD TO PREMIER LEAGUE", "プレミアリーグへの道")}<ol class="hxl">${[...S].reverse().map(node).join("")}</ol>
    ${sec("TITLES", "獲得タイトル")}${titleBoard(S, tc)}
  </div>`;
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

const IN_KINDS = /^(加入|レンタル加入|レンタル復帰|ユース昇格)$/, OUT_KINDS = /^(退団|レンタル移籍)$/;
const KIND_TXT = { レンタル加入: "期限付き加入", レンタル移籍: "期限付き移籍", レンタル復帰: "復帰", ユース昇格: "昇格", 契約延長: "契約更新" };
/* 移籍時の年齢：生年月日があればその日付で計算、なければシートの値 */
function trAge(t) { const p = prof(t.name); return p && p.birth ? age(p.birth, t.date) : t.age; }
function trRow(t) {
  const cls = IN_KINDS.test(t.kind) ? "in" : OUT_KINDS.test(t.kind) ? "out" : "etc";
  const cl = t.club ? t.club + (leagueOf(t.club) ? `（${leagueOf(t.club)}）` : "") : "";
  const from = cls === "in" ? (cl ? `前所属：${cl}` : "") : cls === "out" ? (cl ? `${t.kind === "レンタル移籍" ? "期限付き移籍先" : "移籍先"}：${cl}` : "") : cl;
  return `<div class="trow"><a class="who" href="#/player/${encodeURIComponent(t.name)}">${face(t.name)}<div><b><span class="kind ${cls}">${esc(KIND_TXT[t.kind] || t.kind)}</span>${esc(t.name)}</b>
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
    ${mgr ? sec("MANAGER", "監督") + `<div class="mgr">${face(mgr.name)}<div><span>MANAGER</span><b><a href="#/staff/${encodeURIComponent(mgr.name)}" style="color:inherit">${flag(mgr.nat)}${esc(mgr.name)}</a></b>${mgr.memo ? `<p>${esc(mgr.memo)}</p>` : ""}
      <a class="btn" href="#/staff/${encodeURIComponent(mgr.name)}">PROFILE</a></div></div>` : ""}
    <a class="hist-link" href="#/history"><span><b>HISTORY</b><small>ヒストリー・獲得タイトル</small></span><em>${esc(clubName())}が歩んできた道のり</em><i>›</i></a>
    ${allTime(all, big)}
    ${recs.length ? sec("RECORDS", "通算記録") + `<div class="sgrid sgrid3">${recs.join("")}</div>` : ""}</div>`;
}

/* =====================================================================
   ルーター
   ===================================================================== */
function parseHash() { const h = decodeURIComponent((location.hash || "").replace(/^#\/?/, "")); const [page, ...rest] = h.split("/").filter(Boolean); return { page: page || "home", arg: rest.join("/") || null }; }
function fillSeason() {
  const sel = $("season"); if (!sel) return;
  sel.onchange = () => { ST.season = sel.value; render(); };
}
function render() {
  const { page, arg } = parseHash();
  const V = { home: vHome, news: vNews, matches: vMatches, match: vMatch, table: vTable, stats: vStats, squad: vSquad, player: vPlayer, transfers: vTransfers, club: vClub, history: vHistory, staff: vStaff };
  const B = { news: bNews, matches: bMatches, stats: bStats, match: bMatch, table: bTable };
  const view = $("view");
  $("tip").hidden = true;
  view.innerHTML = (V[page] || vHome)(arg);
  (B[page] || (() => { }))();
  bindTips(view);
  const navKey = { match: "matches", table: "matches", stats: "matches", player: "squad", transfers: "squad", staff: "squad", history: "club" }[page] || page;
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.p === navKey));
  fillSeason();
}
function setMenu(open) { $("tabs").classList.toggle("open", open); $("menu-btn").setAttribute("aria-expanded", open); }
let lastPage = "";
/* ブラウザバックで戻ったときは、そのページで見ていた位置に戻す（各履歴にスクロール位置を保存） */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
let scrollSave = 0;
function sqSpy() {
  const bar = document.querySelector(".sq-jump"); if (!bar) return;
  const top = document.querySelector(".top").offsetHeight + bar.offsetHeight + 24, B = [...bar.querySelectorAll("button")];
  let cur = -1; B.forEach((b, i) => { const el = document.getElementById(b.dataset.id); if (el && el.getBoundingClientRect().top - top <= 0) cur = i; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) { const st = B.findIndex(b => b.dataset.id === "sq-staff"); if (st >= 0 && cur >= 0) cur = Math.max(cur, st); }
  B.forEach((b, i) => b.classList.toggle("on", i === cur));
}
window.addEventListener("scroll", sqSpy, { passive: true });
window.addEventListener("scroll", () => { clearTimeout(scrollSave); scrollSave = setTimeout(() => { try { history.replaceState({ y: scrollY }, ""); } catch (e) { } }, 120); }, { passive: true });
/* 「すべて見る」などで開いた箇所も、戻ったときに開いたままにする */
const OPENED = {}, togBtns = () => [...document.querySelectorAll('#view button[onclick*="toggle(\'open\')"]')];
window.addEventListener("hashchange", () => {
  const p = location.hash, back = history.state && typeof history.state.y === "number" ? history.state.y : null;
  if (lastPage) OPENED[lastPage] = togBtns().map((b, i) => b.parentNode.classList.contains("open") ? i : -1).filter(i => i >= 0);
  if (!/^#\/match\//.test(p)) ST.mtab = "facts"; setMenu(false); render();
  if (back != null && OPENED[p]) { const B = togBtns(); OPENED[p].forEach(i => B[i] && B[i].click()); }
  if (p !== lastPage) { if (back != null) { window.scrollTo(0, back); requestAnimationFrame(() => window.scrollTo(0, back)); setTimeout(() => window.scrollTo(0, back), 300); } else window.scrollTo(0, 0); }
  lastPage = p; sqSpy();
});

(async function init() {
  $("menu-btn").onclick = () => setMenu(!$("tabs").classList.contains("open"));
  try { await loadAll(); } catch (e) { console.error(e); D.err = "データを読み込めませんでした。"; }
  ["brand-name", "foot-name", "copy-name"].forEach(id => $(id).textContent = clubName());
  if (D.conf["創設年"]) $("copy-year").textContent = D.conf["創設年"];
  if (D.conf["サブタイトル"]) $("brand-sub").textContent = D.conf["サブタイトル"];
  $("brand-logo").innerHTML = logo(clubName()); $("foot-logo").innerHTML = logo(clubName());
  render();
})();
