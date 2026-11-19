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
  li:    ["リスト", 12],
  aw:    ["個人タイトル", 13]
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
const shortName = () => D.conf["略称"] || clubName();
function isMe(club) { const k = nameKey(club); return !!k && (k === nameKey(clubName()) || k === nameKey(D.conf["略称"]) || k === nameKey(DEFAULT_CLUB) || /^自分/.test(club)); }
const sideOf = s => /相手|opp|away/i.test(s) ? "opp" : "me";

/* 出場選手シートの数字の列（チームスタッツに無いときは選手の合計を使う） */
const LU_NUM = ["出場時間", "評価", "得点", "アシスト", "シュート", "枠内シュート", "ゴール期待値", "パス", "パス成功", "キーパス", "ドリブル", "ドリブル成功",
  "タックル", "タックル成功", "インターセプト", "ブロック", "クリア", "ボール奪取", "ボールロスト", "走行距離", "セーブ", "失点", "警告", "退場"];
const TS_NUM = ["ボール支配率", "ボール奪取時間", "シュート", "ゴール期待値", "パス", "タックル", "タックル成功", "インターセプト", "セーブ", "ファウル", "オフサイド",
  "コーナーキック", "フリーキック", "PK", "警告", "退場", "枠内シュート", "枠外シュート", "ブロックされたシュート", "ボックス内シュート", "パス成功", "キーパス",
  "クロス", "スルーパス", "ドリブル", "ドリブル成功", "クリア", "ブロック", "空中戦勝利", "走行距離"];
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
  got.li.forEach(o => { const n = F(o, "クラブ"); if (n) D.clubs[nameKey(n)] = { name: n, short: F(o, "略称"), country: F(o, "国"), league: F(o, "リーグ") }; });
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
  const OX = [];
  D.matches = got.match.map((o, i) => {
    const home = F(o, "ホーム"), away = F(o, "アウェイ"); if (!home || !away) return null;
    const hg = num(F(o, "ホーム得点")), ag = num(F(o, "アウェイ得点")), pkr = parsePK(F(o, "PK")), date = pDate(F(o, "日付"));
    if (!isMe(home) && !isMe(away)) { if (hg != null && ag != null) OX.push({ season: F(o, "シーズン"), date, comp: F(o, "大会"), home, away, hg, ag }); return null; }
    const ha = isMe(home) ? "H" : "A", opp = ha === "H" ? away : home;
    const gf = ha === "H" ? hg : ag, ga = ha === "H" ? ag : hg, played = gf != null && ga != null;
    const pk = pkr ? (ha === "H" ? pkr : { a: pkr.b, b: pkr.a }) : null;
    const res = !played ? "U" : gf > ga ? "W" : gf < ga ? "L" : pk ? (pk.a > pk.b ? "W" : "L") : "D";
    return { i, season: F(o, "シーズン"), date, key: dKey(date), comp: F(o, "大会") || "試合", round: F(o, "節・ラウンド"), ha, opp, gf, ga, pk, res, played,
      scorers: parseNames(F(o, "得点者")), assists: parseNames(F(o, "アシスト")), mom: F(o, "MOM"), stadium: F(o, "スタジアム"), att: num(F(o, "観客数")),
      memo: F(o, "メモ"), ts: {}, form: {}, lu: [], luOpp: [], ev: [] };
  }).filter(Boolean);
  D.matches.sort((a, b) => (a.date && b.date ? a.date - b.date : 0) || a.i - b.i);
  D.matches.forEach((m, k) => m.id = k + 1);
  const byKey = {}; D.matches.forEach(m => { if (m.key && !byKey[m.key]) byKey[m.key] = m; });

  got.ts.forEach(o => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; if (!m) return;
    const side = sideOf(F(o, "チーム")), t = {};
    TS_NUM.forEach(h => { const v = num(F(o, h)); if (v != null) t[h] = v; });
    m.ts[side] = t; m.form[side] = F(o, "フォーメーション");
  });
  D.lineups = got.lu.map((o, i) => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; const name = F(o, "名前"); if (!m || !name) return null;
    const s = {}; LU_NUM.forEach(h => { const v = num(F(o, h)); if (v != null) s[h] = v; });
    const l = { i, m, name, side: sideOf(F(o, "チーム")), role: F(o, "出場") || "先発", no: num(F(o, "背番号")), pos: F(o, "ポジション").toUpperCase(), s, rating: s["評価"] ?? null };
    if (l.role !== "ベンチ") (l.side === "opp" ? m.luOpp : m.lu).push(l);
    return l.side === "opp" ? null : l;
  }).filter(Boolean);
  got.ev.forEach((o, i) => {
    const m = byKey[dKey(pDate(F(o, "日付")))]; if (!m) return;
    m.ev.push({ i, min: half(F(o, "分")), mn: minN(F(o, "分")), side: sideOf(F(o, "チーム")), kind: F(o, "種類") || "その他",
      player: F(o, "選手"), rel: F(o, "関連する選手"), note: F(o, "補足") });
  });
  D.matches.forEach(m => {
    m.ev.sort((a, b) => a.mn - b.mn || a.i - b.i);
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
    /* MOM が空欄なら最高評価の選手 */
    if (!m.mom) { const r = [...m.lu, ...m.luOpp].filter(l => l.rating != null).sort((a, b) => b.rating - a.rating)[0]; if (r) { m.mom = r.name; m.momL = r; } }
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
    age: num(F(o, "年齢")), club: F(o, "相手クラブ"), fee: num(F(o, "移籍金")), memo: F(o, "メモ") })).filter(t => t.name);
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
  D.seasons = got.ss.map(o => ({ season: F(o, "シーズン"), league: F(o, "リーグ"), rank: null, titles: F(o, "獲得タイトル"), cap: F(o, "主将"), comment: F(o, "一言") })).filter(s => s.season);
  /* 個人タイトル：1行1受賞（シーズン・大会・タイトル・選手） */
  D.awards = (got.aw || []).map(o => ({ season: F(o, "シーズン"), comp: F(o, "大会"), title: F(o, "タイトル"), name: F(o, "選手") })).filter(a => a.name && a.title);

  /* リーグ順位は自動（シーズンの「リーグ」の順位表から） */
  D.seasons.forEach(s => { const r = D.table.find(t => t.season === s.season && t.comp === (s.league || D.conf["リーグ"]) && isMe(t.club)); if (r) s.rank = r.rank; });
  /* 選手の推移シート：レンタル先が入っている行は、レンタル先での成績 */
  D.loans = got.gr.map(o => ({ season: F(o, "シーズン"), date: pDate(F(o, "日付")), name: F(o, "名前"), club: F(o, "レンタル先"), apps: num(F(o, "出場")), g: num(F(o, "得点")),
    a: num(F(o, "アシスト")), rating: num(F(o, "平均評価")), memo: F(o, "メモ") })).filter(x => x.name && x.club).sort((x, y) => (x.date || 0) - (y.date || 0));
  const ss = new Set([...D.matches, ...D.trans, ...D.table, ...D.seasons, ...D.loans].map(x => x.season).filter(Boolean));
  if (!ss.size && D.conf["最初のシーズン"]) ss.add(D.conf["最初のシーズン"]);
  D.seasonList = [...ss].sort().reverse();
  if (!D.seasonList.length) D.seasonList = [curSeason()];
  const last = D.played[D.played.length - 1];
  ST.season = ST.cur = (last && last.season) || D.seasonList[0];
}
/* 今のシーズン（7月はじまり。例：2026年11月 → 2026-27） */
function curSeason() { const t = gameToday(), y = t.getFullYear(); return t.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; }
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
function imgTag(cands, alt, cls, key, phTxt) {
  const list = IMG_OK[key] ? [IMG_OK[key]] : cands, ini = phTxt || initials(alt);
  if (IMG_OK[key] === false || !list.length) return `<div class="${cls} ph" role="img" aria-label="${esc(alt)}">${esc(ini)}</div>`;
  return `<img class="${cls}" src="${esc(encodeURI(list[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async" data-k="${esc(key)}" data-c="${esc(list.slice(1).join("|"))}"
    data-i="${esc(ini)}" onload="imgOk(this)" onerror="imgNext(this)">`;
}
window.imgOk = el => { const k = el.dataset.k; if (k) IMG_OK[k] = decodeURI(el.getAttribute("src")); };
window.imgNext = el => {
  const rest = (el.dataset.c || "").split("|").filter(Boolean);
  if (rest.length) { el.dataset.c = rest.slice(1).join("|"); el.src = encodeURI(rest[0]); return; }
  if (el.dataset.k) IMG_OK[el.dataset.k] = false;
  const d = document.createElement("div"); d.className = el.className + " ph"; d.textContent = el.dataset.i || "?"; d.setAttribute("role", "img"); d.setAttribute("aria-label", el.alt || "");
  el.replaceWith(d);
};
const prof = name => D.players.find(p => same(p.name, name));
function face(name, cls) {
  const p = prof(name), ph = p && p.photo;
  const c = (ph ? (/\.(png|webp|jpe?g|gif)$/i.test(ph) ? [`images/player/${ph}`] : imgCands("player", [ph])) : []).concat(imgCands("player", [name]));
  return imgTag(c, name, "face " + (cls || ""), "p:" + nameKey(name));
}
function logo(club, cls) {
  const me = isMe(club), names = me ? [clubName(), DEFAULT_CLUB] : [club];
  return imgTag(imgCands("logo", names), me ? clubName() : club, "logo " + (cls || ""), "l:" + (me ? "__me" : nameKey(club)), shortOf(club));
}
/* クラブの略称・リーグ（クラブシート） */
const clubInfo = c => D.clubs[nameKey(c)] || {};
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
  return `<div class="pcard staff"><div class="ph-wrap">${face(p.name)}<span class="pos">${esc(p.role)}</span></div>
    <div class="info"><b>${flag(p.nat)}${esc(p.name)}</b><small>${[p.birth ? age(p.birth) + "歳" : "", p.memo].filter(Boolean).map(esc).join("　") || "&nbsp;"}</small></div></div>`;
}
const staffBlock = () => { const S = staffList(); return S.length ? sec("STAFF", "監督・コーチ") + `<div class="pgrid">${S.map(staffCard).join("")}</div>` : ""; };
function identity() {
  const sq = D.players.filter(p => !/退団/.test(p.status));
  const jp = sq.filter(isJP).length, yo = sq.filter(isYouth).length;
  const sign = D.trans.filter(t => /^(加入|レンタル加入)$/.test(t.kind)).length;
  return `<section class="ident"><div class="ident-in"><div class="ident-g">
    <div><b>${sq.length ? Math.round(jp / sq.length * 100) : 100}<small>%</small></b><span>JAPANESE</span><em>日本人選手</em></div>
    <div><b>${yo}</b><span>ACADEMY</span><em>ユース出身</em></div>
    <div><b>${sq.length - jp}</b><span>FOREIGN</span><em>外国籍選手</em></div>
    <div><b>${sign}</b><span>SIGNINGS</span><em>補強</em></div></div></div></section>`;
}
const pLink = (name, inner) => `<a href="#/player/${encodeURIComponent(name)}">${inner || esc(name)}</a>`;

/* ---------- 評価バッジ ---------- */
function rtCls(r) { return r == null ? "r0" : r >= 9 ? "r9" : r >= 8 ? "r8" : r >= 7 ? "r7" : r >= 6 ? "r6" : "r5"; }
const rt = r => r == null ? "" : `<span class="rt ${rtCls(r)}">${fmtN(r, 1)}</span>`;
const wdl = m => `<span class="wdl ${m.res}" aria-label="${{ W: "勝ち", D: "引き分け", L: "負け" }[m.res]}">${{ W: "W", D: "D", L: "L" }[m.res]}</span>`;
const scoreTxt = m => m.ha === "A" ? `${m.ga} - ${m.gf}` : `${m.gf} - ${m.ga}`;
const homeAway = m => m.ha === "A" ? { home: m.opp, away: clubName(), hs: "opp", as: "me" } : { home: clubName(), away: m.opp, hs: "me", as: "opp" };
const roundTxt = m => [m.comp, m.round].filter(Boolean).join(" ");

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
  { k: "90分あたりの得点", f: p => p.min >= 90 && p.g ? p.g / p.min * 90 : null, u: "", d: 2, base: p => p.min },
  { k: "ゴール期待値", f: p => p.s["ゴール期待値"], u: "", d: 2 },
  { k: "シュート", f: p => p.s["シュート"], u: "", d: 0 },
  { k: "枠内シュート", f: p => p.s["枠内シュート"], u: "", d: 0 },
  { k: "キーパス", f: p => p.s["キーパス"], u: "", d: 0 },
  { k: "パス成功率", f: p => p.s["パス"] ? p.s["パス成功"] / p.s["パス"] * 100 : null, u: "%", d: 1, base: p => p.s["パス"] },
  { k: "ドリブル成功", f: p => p.s["ドリブル成功"], u: "", d: 0 },
  { k: "タックル成功", f: p => p.s["タックル成功"], u: "", d: 0 },
  { k: "インターセプト", f: p => p.s["インターセプト"], u: "", d: 0 },
  { k: "クリア", f: p => p.s["クリア"], u: "", d: 0 },
  { k: "ボール奪取", f: p => p.s["ボール奪取"], u: "", d: 0 },
  { k: "セーブ", f: p => p.s["セーブ"], u: "", d: 0 },
  { k: "クリーンシート", f: p => p.cs, u: "", d: 0 },
  { k: "走行距離", f: p => p.s["走行距離"], u: "km", d: 1 },
  { k: "警告", f: p => p.yc, u: "", d: 0 },
  { k: "退場", f: p => p.rc, u: "", d: 0 }
];
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
  const bc = avg("ボックス内シュート"); if (bc) add("攻撃", "1試合平均ボックス内シュート", bc.avg, "", 1);
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
  const bw = Math.min(26, (W - pl - pr) / n - 4), step = (W - pl - pr) / n;
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
  ball: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.2l4 2.9-1.5 4.7h-5L8 10.1z" fill="currentColor"/></svg>`,
  sub: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.4" aria-hidden="true"><path d="M7 20V5M3 9l4-4 4 4" stroke="#1d9a55"/><path d="M17 4v15M13 15l4 4 4-4" stroke="#d6404a"/></svg>`,
  cup: `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/></svg>`
};
const dotD = d => d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : "--.--";
const dotY = d => d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : "";
const seasonSel = () => `<label class="ssel"><span>SEASON</span><select id="season" aria-label="シーズン">${D.seasonList.map(s => `<option value="${esc(s)}"${s === ST.season ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>`;
const band = (en, jp, withSeason) => `<section class="band"><div class="band-in"><div><h1>${esc(en)}</h1><p>${esc(jp)}</p></div>${withSeason ? seasonSel() : ""}</div></section>`;
const sec = (en, jp, link, linkTxt) => `<h2 class="sec"><b>${esc(en)}</b><small>${esc(jp)}</small>${link ? `<a href="${link}">${esc(linkTxt || "VIEW ALL")}</a>` : ""}</h2>`;
const kickoff = m => { const t = half(m.memo).match(/(\d{1,2}:\d{2})/); return t ? t[1] : ""; };
const venue = m => m.stadium || (m.ha === "H" ? D.conf["ホームスタジアム"] : "") || "";

function matchRow(m) {
  const right = m.played ? `<span class="res ${m.res}">${m.gf}-${m.ga}</span>${m.pk ? `<span class="pk">PK ${m.pk.a}-${m.pk.b}</span>` : ""}`
    : `<span class="up">${kickoff(m) || "VS"}</span>`;
  return `<a class="mrow" href="#/match/${m.id}">
    <div class="d"><b>${dotD(m.date)}</b><span>${m.date ? WDE[m.date.getDay()] : ""}</span></div>
    <div class="t">${logo(m.opp, "md")}<div><small><span class="ha ${m.ha}">${m.ha === "H" ? "HOME" : m.ha === "A" ? "AWAY" : ""}</span>${esc(roundTxt(m))}</small><b>${clubName2(m.opp)}</b></div></div>
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
  return { comp: c, comps, html: `<div class="tw"><table class="t"><thead><tr><th class="pos">順位</th><th class="l">クラブ</th><th>試合</th>${mini ? "" : "<th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th>"}<th>得失差</th><th>勝点</th>${!mini && T.some(r => r.form && r.form.length) ? "<th>直近5試合</th>" : ""}</tr></thead><tbody>
    ${rows.map(r => `<tr class="${isMe(r.club) ? "me" : ""}"><td class="pos">${r.rank ?? ""}</td><td class="club l"><div>${logo(r.club, "sm")}<span>${clubName2(r.club)}</span></div></td><td>${r.p ?? ""}</td>
      ${mini ? "" : `<td>${r.w ?? ""}</td><td>${r.d ?? ""}</td><td>${r.l ?? ""}</td><td>${r.gf ?? ""}</td><td>${r.ga ?? ""}</td>`}<td>${gd(r)}</td><td><b>${r.pts ?? ""}</b></td>${!mini && T.some(r => r.form && r.form.length) ? `<td><span class="form5">${(r.form || []).map(x => `<span class="wdl ${x}">${x}</span>`).join("")}</span></td>` : ""}</tr>`).join("")}</tbody></table></div>` };
}
function rkCard(M, P, label) {
  const R = ranked(P, M); if (!R.length) return "";
  const f = R[0], v = x => fmtN(x, M.d) + (M.u === "%" ? "%" : "");
  return `<div class="rk-card"><a class="rk-top" href="#/player/${encodeURIComponent(f.p.name)}"><div class="who"><h3>${esc(label || M.k)}</h3><b>${esc(f.p.name)}</b><small>${esc(f.p.pos || "")}</small></div>
      ${face(f.p.name)}<div class="big">${v(f.v)}</div></a>
    ${R.slice(1, 5).map((x, i) => `<a class="rk-row" href="#/player/${encodeURIComponent(x.p.name)}"><span class="n">${i + 2}</span><span class="nm">${esc(x.p.name)}</span><span class="val">${v(x.v)}</span></a>`).join("")}
    ${R.length > 5 ? `<a class="all" href="#/stats/${encodeURIComponent(M.k)}">ランキングを見る</a>` : ""}</div>`;
}
const seasonLabel = s => s || "";

/* ---------- ニュース（試合・移籍から自動で作る） ---------- */
const NCAT = { MATCH: "試合", TRANSFER: "移籍", RECORD: "記録", CLUB: "クラブ" };
/* 記録達成（選手・チーム）。区切りの数字に届いた試合で1件 */
const MS_P = { g: { u: "ゴール", en: "GOALS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初ゴール", fe: "FIRST GOAL" }, a: { u: "アシスト", en: "ASSISTS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初アシスト", fe: "FIRST ASSIST" },
  apps: { u: "試合出場", en: "APPS", th: [1, 50, 100], step: 50, first: "トップチームデビュー", fe: "DEBUT" }, cs: { u: "クリーンシート", en: "CLEAN SHEETS", th: [1, 10, 25, 50, 75, 100], step: 50, first: "初クリーンシート", fe: "FIRST CLEAN SHEET" } };
const MS_T = { w: { u: "勝利", en: "WINS", th: [1, 50], step: 50, first: "クラブ初勝利", fe: "FIRST WIN" }, g: { u: "ゴール", en: "GOALS", th: [1, 100], step: 100, first: "クラブ初ゴール", fe: "FIRST GOAL" },
  n: { u: "試合", en: "MATCHES", th: [100], step: 100 }, cs: { u: "クリーンシート", en: "CLEAN SHEETS", th: [25, 50], step: 50 } };
const hit = (def, before, after) => { const out = []; for (let v = before + 1; v <= after; v++) if (def.th.includes(v) || (v > def.th[def.th.length - 1] && v % def.step === 0)) out.push(v); return out; };
function milestones() {
  const N = [], P = {}, T = { w: 0, g: 0, n: 0, cs: 0 };
  D.played.forEach(m => {
    const add = {};
    const inc = (name, k, v) => { if (!name || /オウン/.test(name) || !v) return; const key = nameKey(name); (add[key] = add[key] || { name, g: 0, a: 0, apps: 0, cs: 0 })[k] += v; };
    m.scorers.forEach(x => inc(x.name, "g", x.n)); m.assists.forEach(x => inc(x.name, "a", x.n));
    m.lu.forEach(l => { inc(l.name, "apps", 1); if (/GK/.test(l.pos) && l.role === "先発" && m.ga === 0) inc(l.name, "cs", 1); });
    Object.values(add).forEach(x => { const p = P[nameKey(x.name)] || (P[nameKey(x.name)] = { g: 0, a: 0, apps: 0, cs: 0 });
      Object.keys(MS_P).forEach(k => { hit(MS_P[k], p[k], p[k] + x[k]).filter(v => !(k === "apps" && v === 1 && m === D.played[0])).forEach(v => N.push({ id: `r-${k}-${nameKey(x.name)}-${v}`, d: m.date, cat: "RECORD", m0: m, ms: { who: x.name, k, v, def: MS_P[k] },
        t: v === 1 && MS_P[k].first ? `${x.name}選手 ${MS_P[k].first}` : `${x.name}選手 通算${v}${MS_P[k].u}達成` })); p[k] += x[k]; }); });
    const tx = { w: m.res === "W" ? 1 : 0, g: m.gf, n: 1, cs: m.ga === 0 ? 1 : 0 };
    Object.keys(MS_T).forEach(k => { hit(MS_T[k], T[k], T[k] + tx[k]).forEach(v => N.push({ id: `r-t${k}-${v}`, d: m.date, cat: "RECORD", m0: m, ms: { club: true, k, v, def: MS_T[k] },
      t: v === 1 && MS_T[k].first ? `${clubName()} ${MS_T[k].first}` : `${clubName()} 通算${v}${MS_T[k].u}達成` })); T[k] += tx[k]; });
  });
  return N.concat(milestones2(), milestones3());
}
/* リーグの格（イングランド。数字が小さいほど上） */
function tier(lg) { const s = String(lg || ""); return /プレミア/.test(s) ? 1 : /チャンピオンシップ/.test(s) ? 2 : /リーグ\s*1$/.test(s) ? 3 : /リーグ\s*2$/.test(s) ? 4 : null; }
function leagueOfSeason(se) {
  const t = D.table.filter(r => r.season === se && isMe(r.club)).sort((a, b) => b.p - a.p)[0]; if (t) return t.comp;
  const s = D.seasons.find(x => x.season === se); if (s && s.league) return s.league;
  const c = {}; D.matches.filter(m => m.season === se && tier(m.comp)).forEach(m => c[m.comp] = (c[m.comp] || 0) + 1);
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
}
/* 最多得点差・連敗ストップ・1シーズンのクラブ記録・月間ベストプレーヤー・シーズン終了・昇格／優勝／降格 */
function milestones3() {
  const N = [], push = (m, id, t, ms, d) => N.push({ id, d: d || m.date, cat: "RECORD", m0: m, ms, t });
  let bigM = 0, lose = 0; const best = { g: 0, a: 0 }, cur = {}; let curSe = null;
  D.played.forEach(m => {
    /* 最多得点差の勝利（4点差以上でクラブ記録を更新） */
    const mg = m.gf - m.ga; if (m.res === "W" && mg >= 4 && mg > bigM) push(m, `r-big-${m.id}`, `${clubName()} クラブ史上最多得点差の勝利`, { club: true, big: `+${mg}`, en: "RECORD WIN", txt: `${clubName()}は${m.gf}-${m.ga}で勝利し、クラブ史上最多得点差（${mg}点差）の勝利を記録しました。` });
    if (m.res === "W") bigM = Math.max(bigM, mg);
    /* 連敗ストップ */
    if (m.res === "L") lose++; else { if (lose >= 3) push(m, `r-ls-${m.id}`, `${clubName()} 連敗を${lose}でストップ`, { club: true, big: lose, en: "STREAK ENDED", txt: `${clubName()}は${m.res === "W" ? "勝利" : "引き分け"}で、連敗を${lose}で止めました。` }); lose = 0; }
    /* 1シーズンのクラブ記録（ゴール・アシスト）。過去のシーズンの記録を超えたとき1回だけ */
    if (m.season !== curSe) { Object.values(cur).forEach(p => { best.g = Math.max(best.g, p.g); best.a = Math.max(best.a, p.a); }); Object.keys(cur).forEach(k => delete cur[k]); curSe = m.season; }
    [["g", m.scorers, "ゴール"], ["a", m.assists, "アシスト"]].forEach(([k, L, u]) => L.forEach(x => { if (/オウン/.test(x.name)) return; const key = nameKey(x.name), p = cur[key] || (cur[key] = { g: 0, a: 0, done: {} });
      p[k] += x.n; if (best[k] > 0 && p[k] > best[k] && !p.done[k]) { p.done[k] = 1; push(m, `r-sr-${k}-${m.season}-${key}`, `${x.name}選手 クラブのシーズン最多${u}記録を更新`, { who: x.name, big: p[k], en: k === "g" ? "GOALS" : "ASSISTS", txt: `${x.name}選手が今シーズン${p[k]}${u}目を記録し、クラブの1シーズン最多${u}記録（${best[k]}）を更新しました。` }); } }));
  });
  /* 月間ベストプレーヤー（翌月の試合が入ったら） */
  const byM = {}; D.played.forEach(m => { if (m.date) (byM[`${m.date.getFullYear()}-${pad(m.date.getMonth() + 1)}`] = byM[`${m.date.getFullYear()}-${pad(m.date.getMonth() + 1)}`] || []).push(m); });
  const months = Object.keys(byM).sort();
  months.slice(0, -1).forEach(k => { const L = byM[k], R = {};
    L.forEach(m => m.lu.forEach(l => { if (l.rating == null) return; const r = R[nameKey(l.name)] || (R[nameKey(l.name)] = { name: l.name, s: 0, n: 0 }); r.s += l.rating; r.n++; }));
    const need = Math.max(1, Math.ceil(L.length / 2)), top = Object.values(R).filter(r => r.n >= need).sort((a, b) => b.s / b.n - a.s / a.n)[0]; if (!top) return;
    const last = L[L.length - 1], mo = parseInt(k.slice(5), 10);
    push(last, `r-mvp-${k}`, `${mo}月の月間ベストプレーヤーに${top.name}選手`, { who: top.name, big: fmtN(top.s / top.n, 2), en: "MONTHLY MVP",
      html: `<p>${mo}月の月間ベストプレーヤーに、${esc(top.name)}選手が選ばれました。${mo}月は${top.n}試合に出場し、平均評価は${fmtN(top.s / top.n, 2)}でした。</p><p class="nbtn"><a class="btn" href="#/player/${encodeURIComponent(top.name)}">PLAYER PROFILE</a></p>` }); });
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
    if ([3, 5, 7, 10, 15, 20].includes(win)) { const nr = win > rec.win && rec.win >= 3; push(m, `r-ws-${m.id}`, `${clubName()} ${nr ? "クラブ新記録の" : ""}${win}連勝`, { club: true, big: win, en: "WINS IN A ROW", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}${win}連勝を達成しました。` }); }
    if (unb >= 5 && unb % 5 === 0) { const nr = unb > rec.unb && rec.unb >= 5; push(m, `r-ub-${m.id}`, `${clubName()} ${nr ? "クラブ新記録の" : ""}${unb}試合無敗`, { club: true, big: unb, en: "UNBEATEN", txt: `${clubName()}は${nr ? "クラブ新記録となる" : ""}公式戦${unb}試合無敗となりました。` }); }
    rec.win = Math.max(rec.win, win); rec.unb = Math.max(rec.unb, unb);
    /* クラブ最年少（デビュー・ゴール）。最初の記録は記事にしない */
    const chk = (kind, name) => { const p = prof(name); if (!p || !p.birth || !m.date) return; const a = ageTxt(p.birth, m.date);
      const cur = yng[kind]; if (!cur || a.ms < cur) { if (cur) push(m, `r-yg-${kind}-${m.id}-${nameKey(name)}`, `${name}選手 クラブ史上最年少${kind === "debut" ? "デビュー" : "ゴール"}`,
        { who: name, big: a.y, en: "YEARS OLD", sub: `${a.y}歳${a.days}日`, txt: `${name}選手が${a.y}歳${a.days}日で${kind === "debut" ? "トップチームデビュー" : "ゴール"}を記録し、クラブ史上最年少記録を更新しました。` });
        yng[kind] = a.ms; } };
    m.lu.forEach(l => { const k = nameKey(l.name); if (!seen.has(k)) { seen.add(k); chk("debut", l.name); } });
    m.scorers.forEach(x => { if (!/オウン/.test(x.name)) chk("goal", x.name); });
    /* MOM */
    if (m.mom && !(m.momL && m.momL.side === "opp")) { const k = nameKey(m.mom), c = (mom[k] = (mom[k] || 0) + 1);
      if (c === 5 || (c >= 10 && c % 10 === 0)) push(m, `r-mom-${k}-${c}`, `${m.mom}選手 通算${c}回目のMOM`, { who: m.mom, big: c, en: "MOM", txt: `${m.mom}選手が通算${c}回目のマン・オブ・ザ・マッチに選ばれました。` }); }
  });
  return N;
}
function buildNews() {
  const N = [];
  D.played.forEach(m => N.push({ id: "m" + m.id, d: m.date, cat: "MATCH", m, kind: "result", t: `【試合結果】${roundTxt(m)} ${m.opp}戦` }));
  const nx = D.matches.find(m => !m.played), lp = D.played[D.played.length - 1];
  if (nx) N.push({ id: "n" + nx.id, d: lp ? lp.date : nx.date, cat: "MATCH", m: nx, kind: "info", top: 1, t: `【試合情報】${roundTxt(nx)} ${nx.opp}戦` });
  const TT = { 加入: n => `${n}選手 加入のお知らせ`, レンタル加入: n => `${n}選手 期限付き移籍加入のお知らせ`, レンタル復帰: n => `${n}選手 期限付き移籍からの復帰のお知らせ`,
    ユース昇格: n => `${n}選手 トップチーム昇格のお知らせ`, 契約延長: n => `${n}選手 契約更新のお知らせ`,
    退団: (n, c) => c ? `${n}選手 ${c}へ完全移籍のお知らせ` : `${n}選手 退団のお知らせ`, レンタル移籍: (n, c) => `${n}選手 ${c ? c + "へ" : ""}期限付き移籍のお知らせ` };
  const YO = D.trans.filter(t => t.kind === "ユース昇格").sort((x, y) => (x.date || 0) - (y.date || 0) || x.i - y.i);
  D.trans.forEach(t => N.push({ id: "t" + t.i, d: t.date, cat: "TRANSFER", tr: t, yno: t.kind === "ユース昇格" ? YO.indexOf(t) + 1 : 0, t: (TT[t.kind] || (n => `${n}選手 ${t.kind}のお知らせ`))(t.name, t.club) }));
  D.seasons.forEach(s => {
    const last = D.played.filter(m => m.season === s.season).pop();
    String(s.titles || "").split(/[、,，\/／]/).map(x => x.trim()).filter(Boolean).forEach((t, k) => N.push({ id: "c" + s.season + "-" + k, d: last && last.date, cat: "CLUB", title: t, season: s.season, top: 1, t: `${t} 優勝のお知らせ` }));
  });
  N.push(...milestones());
  return N.filter(n => n.d).sort((a, b) => b.d - a.d || (b.top || 0) - (a.top || 0) || (a.cat === "MATCH" ? -1 : 0));
}
/* サムネイル（画像の代わりに、試合ならエンブレムとスコア、移籍なら選手） */
function newsThumb(n) {
  if (n.ms) { const s = n.ms;
    return `<div class="nt nt-r${s.club ? " club" : ""}">${s.club ? logo(clubName(), "md") : face(s.who)}<div class="nt-w">${s.en ? `${s.big !== "" && s.big != null ? `<span class="nt-num">${s.big}</span>` : ""}${s.en}` : s.v === 1 && s.def.fe ? s.def.fe : `<span class="nt-num">${s.v}</span>${s.def.en}`}<small>${esc(s.club ? clubName() : s.who)}</small></div></div>`; }
  if (n.m) { const h = homeAway(n.m);
    return `<div class="nt nt-m"><div class="nt-c">${logo(h.home, "md")}</div><div class="nt-s">${n.kind === "result" ? scoreTxt(n.m) : "VS"}<small>${n.kind === "result" ? "RESULT" : dotD(n.m.date)}</small></div><div class="nt-c">${logo(h.away, "md")}</div></div>`; }
  if (n.tr) { const t = n.tr, pr = prof(t.name) || {};
    const w = { 加入: "WELCOME", レンタル加入: "WELCOME", ユース昇格: "PROMOTED", レンタル復帰: "RETURN", 退団: "THANK YOU", レンタル移籍: "ON LOAN", 契約延長: "RENEWED" }[t.kind] || "NEWS";
    const tag = t.kind === "ユース昇格" ? `ACADEMY GRADUATE${n.yno ? " #" + n.yno : ""}` : t.kind === "レンタル移籍" && t.club ? `→ ${t.club}` : "";
    return `<div class="nt nt-x${t.kind === "ユース昇格" ? " is-acad" : t.kind === "退団" ? " is-out" : ""}"><div class="nx-bg">${logo(clubName(), "")}</div>${face(t.name)}
      <div class="nx-t">${tag ? `<span class="nx-tag">${esc(tag)}</span>` : ""}<b class="nx-h">${w}</b><span class="nx-n">${esc(pr.roma || t.name)}</span>${pr.roma ? `<span class="nx-j">${esc(t.name)}</span>` : ""}<span class="nx-c">${logo(clubName(), "")}${esc(clubName())}</span></div></div>`; }
  return `<div class="nt nt-c2">${ICON.cup}<div class="nt-w">CHAMPIONS<small>${esc(n.title || "")}</small></div></div>`;
}
const newsCard = n => `<a class="ncard" href="#/news/${encodeURIComponent(n.id)}">${newsThumb(n)}<div class="nb"><div class="nmeta"><time>${dotY(n.d)}</time><span class="cat c-${n.cat}">${NCAT[n.cat]}</span></div><b>${esc(n.t)}</b></div></a>`;
const newsList = L => `<div class="news">${L.map(n => `<a href="#/news/${encodeURIComponent(n.id)}"><time>${dotY(n.d)}</time><span class="cat c-${n.cat}">${NCAT[n.cat]}</span><b>${esc(n.t)}</b></a>`).join("")}</div>`;
function newsBody(n) {
  const P = s => `<p>${s}</p>`;
  if (n.ms && n.ms.html) return n.ms.html;
  if (n.ms) { const s = n.ms, m = n.m0, d = m.date, when = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）の${esc(roundTxt(m))} ${esc(m.opp)}戦`;
    const txt = s.txt ? `${when}で、${esc(s.txt)}` : s.club ? (s.v === 1 && s.def.first ? `${when}で、${esc(clubName())}は${s.def.first}を記録しました。` : `${when}で、${esc(clubName())}は公式戦通算${s.v}${s.def.u}を達成しました。`)
      : (s.v === 1 && s.def.first ? `${when}で、${esc(s.who)}選手が${s.def.first}${s.k === "apps" ? "を果たしました" : "を記録しました"}。` : `${when}で、${esc(s.who)}選手が公式戦通算${s.v}${s.def.u}を達成しました。`);
    return P(txt) + `<p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH REPORT</a>${s.club ? "" : ` <a class="btn" href="#/player/${encodeURIComponent(s.who)}">PLAYER PROFILE</a>`}</p>`; }
  if (n.m && n.kind === "result") { const m = n.m, d = m.date;
    const v = { W: "勝利しました", D: "引き分けました", L: "敗れました" }[m.res];
    let s = P(`${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）${venue(m) ? `に${esc(venue(m))}で` : "に"}行われた${esc(roundTxt(m))}で、${esc(clubName())}は${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk ? `（PK ${m.pk.a}-${m.pk.b}）` : ""}で${v}。`);
    if (m.scorers.length) s += P(`得点者：${m.scorers.map(x => esc(x.name) + (x.n > 1 ? `（${x.n}点）` : "")).join("、")}`);
    if (m.mom) s += P(`マン・オブ・ザ・マッチ：${esc(m.mom)}`);
    return s + `<p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH REPORT</a></p>`; }
  if (n.m) { const m = n.m, d = m.date, H = D.played.filter(x => same(x.opp, m.opp)), r = record(H);
    return P(`${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）${kickoff(m) ? kickoff(m) + "キックオフ" : ""}の${esc(roundTxt(m))}で、${esc(clubName())}は${venue(m) ? esc(venue(m)) + "で" : m.ha === "H" ? "ホームで" : "アウェイで"}${esc(m.opp)}と対戦します。`)
      + (H.length ? P(`${esc(m.opp)}との対戦成績は${r.n}試合${r.w}勝${r.d}分${r.l}敗です。`) : P(`${esc(m.opp)}とは初めての対戦です。`))
      + `<p class="nbtn"><a class="btn" href="#/match/${m.id}">MATCH INFO</a></p>`; }
  if (n.tr) { const t = n.tr, pr = prof(t.name) || {}, cl = t.club ? esc(t.club) + (leagueOf(t.club) ? `（${esc(leagueOf(t.club))}）` : "") : "";
    const who = `${esc(t.name)}選手${t.pos || t.age != null ? `（${[t.pos, t.age != null ? t.age + "歳" : ""].filter(Boolean).join("／")}）` : ""}`;
    const tx = { ユース昇格: `${who}が、アカデミーからトップチームに昇格することが決まりましたので、お知らせいたします。`,
      退団: cl ? `${who}が、${cl}へ完全移籍することが決まりましたので、お知らせいたします。` : `${who}が退団することになりましたので、お知らせいたします。`,
      レンタル移籍: `${who}が、${cl || "他クラブ"}へ期限付き移籍することが決まりましたので、お知らせいたします。`,
      レンタル復帰: `期限付き移籍中の${who}が、${cl ? cl + "から" : ""}復帰することになりましたので、お知らせいたします。`,
      契約延長: `${who}と契約を更新しましたので、お知らせいたします。`, 加入: `${who}が加入することが決まりましたので、お知らせいたします。` }[t.kind] || `${who}について、${esc(t.kind)}のお知らせです。`;
    return P(tx) + (n.yno ? P(`${esc(t.name)}選手は、クラブ史上${n.yno}人目のアカデミー出身のトップチーム選手となります。`) : "") + (t.memo ? P(esc(t.memo)) : "") + `<p class="nbtn"><a class="btn" href="#/player/${encodeURIComponent(t.name)}">PLAYER PROFILE</a></p>`; }
  return P(`${esc(n.season)}シーズン、${esc(clubName())}は${esc(n.title)}で優勝しました。`) + `<p class="nbtn"><a class="btn" href="#/club">CLUB</a></p>`;
}
function vNewsDetail(id) {
  const all = buildNews(), i = all.findIndex(n => n.id === id), n = all[i];
  if (!n) return band("NEWS", "ニュース") + `<div class="wrap narrow">${empty("記事が見つかりません。")}</div>`;
  const pv = all[i + 1], nx = all[i - 1];
  return band("NEWS", "ニュース") + `<div class="wrap narrow"><article class="art"><div class="nmeta"><time>${dotY(n.d)}</time><span class="cat c-${n.cat}">${NCAT[n.cat]}</span></div>
    <h1>${esc(n.t)}</h1><div class="art-th">${newsThumb(n)}</div><div class="art-b">${newsBody(n)}</div></article>
    <nav class="mnav">${pv ? `<a class="mnav-a" href="#/news/${encodeURIComponent(pv.id)}"><small>‹ 前の記事</small><b>${esc(pv.t)}</b></a>` : "<span></span>"}<a class="btn" href="#/news">NEWS</a>${nx ? `<a class="mnav-a" href="#/news/${encodeURIComponent(nx.id)}"><small>次の記事 ›</small><b>${esc(nx.t)}</b></a>` : "<span></span>"}</nav></div>`;
}

/* ---------- 試合カード（トップの GAME SCHEDULE） ---------- */
function gameCard(m, lab) {
  const h = homeAway(m), d = m.date;
  return `<div class="gcard${m.played ? "" : " up"}"><div class="g-lab">${lab}</div>
    <div class="g-comp">${esc(roundTxt(m))}</div>
    <div class="g-date"><b>${d ? `${d.getMonth() + 1}/${d.getDate()}` : ""}</b><span>${d ? WDE[d.getDay()] : ""}</span>${kickoff(m) ? `<em>${kickoff(m)}</em>` : ""}<span class="g-ha ${m.ha}">${m.ha === "H" ? "HOME" : m.ha === "A" ? "AWAY" : ""}</span></div>
    <div class="g-vs"><div class="g-club">${logo(h.home, "lg")}<span>${esc(h.home)}</span></div>
      <div class="g-sc">${m.played ? `<b>${scoreTxt(m)}</b>${m.pk ? `<small>PK ${m.ha === "A" ? m.pk.b + "-" + m.pk.a : m.pk.a + "-" + m.pk.b}</small>` : ""}` : `<b class="vs">VS</b>`}</div>
      <div class="g-club">${logo(h.away, "lg")}<span>${esc(h.away)}</span></div></div>
    <div class="g-venue">${esc(venue(m) || "")}</div>
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
      <div class="kv-txt">${D.conf["スローガン"] ? `<p class="kv-sl">${slogan(D.conf["スローガン"])}</p>` : ""}<p class="kv-lab">${nextHome.ha === "H" ? "NEXT HOME GAME" : "NEXT MATCH"}</p><p class="kv-comp">${esc(roundTxt(nextHome))}</p>
        <p class="kv-date"><b>${dotD(d)}</b><span>${d ? WDE[d.getDay()] : ""}</span>${kickoff(nextHome) ? `<em>${kickoff(nextHome)} KICK OFF</em>` : ""}</p>
        <p class="kv-venue">${esc(venue(nextHome) || "")}</p><a class="btn w" href="#/match/${nextHome.id}">MATCH INFO</a></div>
      <div class="kv-vs"><div>${logo(h.home, "xl")}<span>${esc(h.home)}</span></div><b>VS</b><div>${logo(h.away, "xl")}<span>${esc(h.away)}</span></div></div></div></section>`; })()
    : `<section class="kv"><div class="kv-in"><div class="hero-club">${logo(clubName(), "xl")}<div><p class="kv-lab">${esc(s)} SEASON</p><h1 class="hero-name">${esc(clubName())}</h1>${D.conf["スローガン"] ? `<p class="kv-sl" style="margin:12px 0 0">${slogan(D.conf["スローガン"])}</p>` : ""}</div></div></div></section>`;
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
    ${news.length ? `<div class="ngrid">${news.slice(0, 4).map(newsCard).join("")}</div>${news.length > 4 ? newsList(news.slice(4, 9)) : ""}` : `<div class="panel">${empty("ニュースはまだありません。")}</div>`}
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
  const all = buildNews(), cats = ["ALL", ...Object.keys(NCAT).filter(c => all.some(n => n.cat === c))];
  if (!cats.includes(ST.ncat)) ST.ncat = "ALL";
  const L = all.filter(n => ST.ncat === "ALL" || n.cat === ST.ncat);
  return band("NEWS", "ニュース") + `<div class="wrap">
    <div class="pills" id="ncat">${cats.map(c => `<button class="pill${c === ST.ncat ? " on" : ""}" data-c="${c}">${c === "ALL" ? "すべて" : NCAT[c]}</button>`).join("")}</div>
    ${L.length ? `<div class="ngrid">${L.slice(0, 4).map(newsCard).join("")}</div>${L.length > 4 ? newsList(L.slice(4, 100)) : ""}` : `<div class="panel">${empty("ニュースはまだありません。")}</div>`}</div>`;
}
function bNews() { document.querySelectorAll("#ncat .pill").forEach(b => b.onclick = () => { ST.ncat = b.dataset.c; render(); }); }

function vMatches() {
  const s = ST.season, M = D.matches.filter(m => !s || m.season === s);
  const comps = ["すべて", ...new Set(M.map(m => m.comp))];
  if (!comps.includes(ST.comp)) ST.comp = "すべて";
  const L = M.filter(m => ST.comp === "すべて" || m.comp === ST.comp);
  const groups = {}; L.forEach(m => { const k = m.date ? `${m.date.getFullYear()}.${pad(m.date.getMonth() + 1)}` : "-"; (groups[k] = groups[k] || []).push(m); });
  const r = record(L.filter(m => m.played));
  return band("MATCHES", "試合日程・結果", true) + `<div class="wrap narrow">
    ${comps.length > 2 ? `<div class="pills" id="comp-pills">${comps.map(c => `<button class="pill${c === ST.comp ? " on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${r.n ? `<p class="mrec">${r.n}試合　${r.w}勝 ${r.d}分 ${r.l}敗　得点 ${r.gf}　失点 ${r.ga}</p>` : ""}
    <div class="mlist">${Object.keys(groups).map(g => `<div class="mh">${esc(g)}</div>${groups[g].map(matchRow).join("")}`).join("") || `<div class="panel">${empty("試合はまだありません。")}</div>`}</div></div>`;
}
function bMatches() { document.querySelectorAll("#comp-pills .pill").forEach(b => b.onclick = () => { ST.comp = b.dataset.c; render(); }); }

/* ---- 試合詳細 ---- */
const CMP = [
  ["主要スタッツ", [["ゴール期待値", 2], ["シュート", 0], ["枠内シュート", 0], ["パス", 0], ["パス成功率", 0, "%"], ["タックル", 0], ["ファウル", 0, "", true], ["コーナーキック", 0], ["警告", 0, "", true], ["退場", 0, "", true]]],
  ["シュート", [["シュート", 0], ["枠内シュート", 0], ["枠外シュート", 0], ["ブロックされたシュート", 0], ["ボックス内シュート", 0], ["ゴール期待値", 2]]],
  ["パス", [["パス", 0], ["パス成功", 0], ["パス成功率", 0, "%"], ["キーパス", 0], ["クロス", 0], ["スルーパス", 0]]],
  ["守備", [["タックル", 0], ["タックル成功", 0], ["タックル成功率", 0, "%"], ["インターセプト", 0], ["ブロック", 0], ["クリア", 0], ["空中戦勝利", 0], ["セーブ", 0], ["ボール奪取時間", 1, "秒", true]]],
  ["その他", [["ドリブル", 0], ["ドリブル成功", 0], ["ドリブル成功率", 0, "%"], ["オフサイド", 0, "", true], ["フリーキック", 0], ["PK", 0], ["走行距離", 1, "km"]]]
];
function cmpRow(label, a, b, d, u, low) {
  if (a == null && b == null) return "";
  const better = a == null || b == null || a === b ? 0 : ((a > b) !== !!low ? 1 : 2);
  const tot = (a || 0) + (b || 0), pa = tot ? (a || 0) / tot * 100 : 0, pb = tot ? (b || 0) / tot * 100 : 0;
  const f = v => v == null ? "-" : fmtN(v, d) + (u === "%" ? "%" : "");
  return `<div class="crow"><div class="v me${better === 1 ? " win" : ""}"><b>${f(a)}</b></div><div class="lab">${esc(label)}${u && u !== "%" ? `（${u}）` : ""}</div>
    <div class="v r op${better === 2 ? " win" : ""}"><b>${f(b)}</b></div>
    <div class="bars"><span><i style="width:${pa}%"></i></span><span><i style="width:${pb}%"></i></span></div></div>`;
}
function vMatch(id) {
  const m = D.matches.find(x => x.id === parseInt(id, 10)); if (!m) return `<div class="wrap">${empty("試合が見つかりません。")}</div>`;
  const h = homeAway(m);
  if (!["facts", "stats", "lineup"].includes(ST.mtab)) ST.mtab = "facts";
  const evGoals = side => m.ev.filter(e => e.side === side && isGoal(e));
  const goalsTxt = side => {
    const E = evGoals(side);
    if (E.length) return E.map(e => `${esc(e.player)} ${esc(e.min)}'${e.kind === "PKゴール" ? "(PK)" : e.kind === "オウンゴール" ? "(OG)" : ""}`).join("<br>");
    return side === "me" ? m.scorers.map(x => `${esc(x.name)}${x.n > 1 ? ` ×${x.n}` : ""}`).join("<br>") : "";
  };
  const hG = goalsTxt(h.hs), aG = goalsTxt(h.as);
  const club = c => `<div class="club">${logo(c, "lg")}<span>${esc(c)}</span></div>`;
  const tabs = [["facts", "SUMMARY", "概要"], ["stats", "STATS", "スタッツ"], ["lineup", "LINE-UP", "メンバー"]];
  let body = "";
  if (m.played) body = ST.mtab === "facts" ? matchFacts(m, h) : ST.mtab === "stats" ? matchStats(m, h, false) : matchLineup(m);
  else body = `<div class="prof">${[["日時", fmtDW(m.date) + (kickoff(m) ? " " + kickoff(m) : "")], ["大会", roundTxt(m)], ["会場", venue(m) || (m.ha === "H" ? "ホーム" : m.ha === "A" ? "アウェイ" : "中立地")], ["対戦相手", m.opp]]
    .map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>${headToHead(m)}`;
  return `<section class="mhead"><div class="mhead-in"><div class="meta">${esc(roundTxt(m))}　${dotY(m.date)} ${m.date ? WDE[m.date.getDay()] : ""}${venue(m) ? "　" + esc(venue(m)) : ""}</div>
      <div class="vs">${club(h.home)}<div>${m.played ? `<div class="score">${scoreTxt(m)}</div><span class="ft">FULL TIME${m.pk ? ` ／ PK ${m.ha === "A" ? m.pk.b + "-" + m.pk.a : m.pk.a + "-" + m.pk.b}` : ""}</span>`
        : `<div class="kick">${kickoff(m) || "VS"}</div><span class="ft">KICK OFF</span>`}</div>${club(h.away)}</div>
      ${m.played && (hG || aG) ? `<div class="scorers"><div>${hG}</div><div class="ico">${ICON.ball}</div><div>${aG}</div></div>` : ""}</div></section>
    ${m.played ? `<nav class="mtabs" id="mtabs">${tabs.map(([k, e, j]) => `<a href="javascript:void 0" data-t="${k}" class="${ST.mtab === k ? "on" : ""}">${e}<small>${j}</small></a>`).join("")}</nav>` : ""}
    <div class="wrap narrow"><div class="panel">${body}</div>${(() => { const i = D.matches.indexOf(m), pv = D.matches[i - 1], nx = D.matches[i + 1];
      const lk = (x, lab) => x ? `<a class="mnav-a" href="#/match/${x.id}"><small>${lab}</small><b>${esc(x.opp)}</b><span>${dotY(x.date)}${x.played ? `　${x.gf}-${x.ga}` : ""}</span></a>` : "<span></span>";
      return `<nav class="mnav">${lk(pv, "‹ 前の試合")}<a class="btn" href="#/matches">MATCHES</a>${lk(nx, "次の試合 ›")}</nav>`; })()}</div>`;
}
function bMatch() { document.querySelectorAll("#mtabs a").forEach(a => a.onclick = () => { ST.mtab = a.dataset.t; render(); }); }
function headToHead(m) {
  const L = D.played.filter(x => same(x.opp, m.opp)); if (!L.length) return "";
  const r = record(L);
  return `<div class="ph">${esc(m.opp)}との対戦成績<small>${r.w}勝 ${r.d}分 ${r.l}敗</small></div><div class="mlist">${L.slice(-5).reverse().map(matchRow).join("")}</div>`;
}
function matchFacts(m, h) {
  const evs = m.ev.filter(e => e.kind !== "その他" || e.note);
  const icon = e => `<span class="ico">${isGoal(e) ? ICON.ball : e.kind === "警告" ? `<i class="cardY"></i>` : e.kind === "退場" ? `<i class="cardR"></i>` : e.kind === "交代" ? ICON.sub : ""}</span>`;
  const evTxt = e => {
    const nm = e.side === "me" ? pLink(e.player) : esc(e.player);
    const sub = e.kind === "交代" ? `<small>OUT ${esc(e.rel)}</small>` : isGoal(e) && e.rel ? `<small>アシスト：${esc(e.rel)}</small>` : e.kind === "オウンゴール" ? "<small>オウンゴール</small>" : e.kind === "PKゴール" ? "<small>PK</small>" : e.note ? `<small>${esc(e.note)}</small>` : "";
    return `<div>${nm}${sub}</div>`;
  };
  let ht = false;
  const tl = evs.map(e => {
    let pre = ""; if (!ht && e.mn > 45.99 && e.mn < 999) { ht = true; pre = `<div class="ev-ht">HALF TIME</div>`; }
    const left = (e.side === "me") === (h.hs === "me");
    return pre + `<div class="ev"><div class="l">${left ? evTxt(e) + icon(e) : ""}</div><div class="m">${esc(e.min)}${e.min ? "'" : ""}</div><div class="r">${left ? "" : icon(e) + evTxt(e)}</div></div>`;
  }).join("");
  const mom = m.mom ? (() => { const l = m.momL, op = l && l.side === "opp", inner = `<span class="no">${l && l.no != null ? l.no : ""}</span>${face(m.mom)}<div class="nm"><b>${esc(m.mom)}</b><small>${esc(l ? l.pos : "")}${op ? "　" + esc(m.opp) : ""}</small></div>${l ? rt(l.rating) : ""}`;
    return `<div class="ph">MAN OF THE MATCH</div>${op ? `<div class="prow">${inner}</div>` : `<a class="prow" href="#/player/${encodeURIComponent(m.mom)}">${inner}</a>`}`; })() : "";
  const stats = matchStats(m, h, true);
  return `${mom}${tl ? `<div class="ph">試合経過</div>${tl}` : ""}${stats}${m.memo ? `<p style="padding:14px 18px;margin:0;color:var(--tx2)">${esc(m.memo)}</p>` : ""}
    ${!mom && !tl && !stats ? empty("試合の詳細はまだありません。") : ""}`;
}
function matchStats(m, h, short) {
  const H = h.hs, A = h.as;
  const pa = tv(m, H, "ボール支配率"), pb = tv(m, A, "ボール支配率");
  const groups = short ? [CMP[0]] : CMP;
  const body = groups.map(([g, L]) => { const rows = L.map(([k, d, u, low]) => cmpRow(k, tv(m, H, k), tv(m, A, k), d, u, low)).join(""); return rows ? `<div class="cmp-sec">${short ? "" : `<h3>${esc(g)}</h3>`}${rows}</div>` : ""; }).join("");
  if (!body && pa == null && pb == null) return short ? "" : empty("スタッツはまだありません。");
  const poss = (pa != null || pb != null) ? (() => { const a = pa ?? 100 - pb, b = pb ?? 100 - pa; return `<div class="cmp-sec"><h3>ボール支配率</h3><div class="poss"><div style="flex:${a}">${fmtN(a)}%</div><div style="flex:${b}">${fmtN(b)}%</div></div></div>`; })() : "";
  const fm = k => m.form[k] ? `<small>${esc(m.form[k])}</small>` : "";
  return `<div class="cmpw${H === "opp" ? " sw" : ""}">${short ? `<div class="ph">スタッツ<a href="javascript:void 0" onclick="ST.mtab='stats';render()">すべて見る</a></div>` : ""}
    <div class="cmp-legend"><span><i style="background:var(--cl)"></i>${clubName2(H === "me" ? clubName() : m.opp)} ${fm(H)}</span><span>${fm(A)} ${clubName2(A === "me" ? clubName() : m.opp)}<i style="background:var(--cr)"></i></span></div>
    ${poss}${body}</div>`;
}
const POSXY = { GK: [50, 91], SW: [50, 82], RB: [86, 72], RCB: [66, 78], CB: [50, 79], LCB: [34, 78], LB: [14, 72], RWB: [88, 60], LWB: [12, 60],
  CDM: [50, 64], RDM: [66, 64], LDM: [34, 64], CM: [50, 52], RCM: [70, 53], LCM: [30, 53], RM: [88, 46], LM: [12, 46], CAM: [50, 38], RAM: [70, 38], LAM: [30, 38],
  RW: [84, 24], LW: [16, 24], RF: [66, 20], LF: [34, 20], CF: [50, 22], ST: [50, 15], RS: [64, 15], LS: [36, 15] };
function matchLineup(m) {
  if (!m.lu.length && !m.luOpp.length) return empty("メンバーの記録はありません。");
  const h = homeAway(m);
  const team = (L, side) => {
    const XI = L.filter(l => l.role === "先発"), subs = L.filter(l => l.role !== "先発"), me = side === "me", used = {};
    const pos = l => { const p = POSXY[l.pos] || POSXY[{ GK: "GK", DF: "CB", MF: "CM", FW: "ST" }[l.pos]] || [50, 50]; const k = p.join(); used[k] = (used[k] || 0) + 1; return [p[0] + (used[k] - 1) * 16 * (used[k] % 2 ? 1 : -1), p[1]]; };
    const gIcon = l => l.s["得点"] ? ICON.ball.repeat(Math.min(3, l.s["得点"])) : "";
    const tag = (l, cls, style, inner) => me ? `<a class="${cls}" href="#/player/${encodeURIComponent(l.name)}"${style}>${inner}</a>` : `<div class="${cls}"${style}>${inner}</div>`;
    const pitch = XI.length ? `<div class="pitch${me ? "" : " opp"}">${XI.map(l => { const [x, y] = pos(l); return tag(l, "pl", ` style="left:${x}%;top:${y}%"`, `${face(l.name)}${rt(l.rating)}<span class="gl">${gIcon(l)}</span><span>${l.no != null ? l.no + " " : ""}${esc(l.name)}</span>`); }).join("")}</div>` : "";
    const row = l => tag(l, "prow", "", `<span class="no">${l.no ?? ""}</span>${face(l.name)}<div class="nm"><b>${esc(l.name)}</b><small>${esc(l.pos)}${l.s["出場時間"] != null ? `　${l.s["出場時間"]}分` : ""}${l.s["得点"] ? `　${l.s["得点"]}得点` : ""}${l.s["アシスト"] ? `　${l.s["アシスト"]}アシスト` : ""}</small></div>${rt(l.rating)}`);
    const club = me ? clubName() : m.opp;
    if (!L.length) return `<div class="lu-col"><div class="ph">${logo(club, "sm")} ${esc(club)}</div>${empty("記録なし")}</div>`;
    return `<div class="lu-col"><div class="ph">${logo(club, "sm")} ${esc(club)}<small>${esc(m.form[side] || "")}</small></div>${pitch}${XI.map(row).join("")}
      ${subs.length ? `<div class="ph">SUBSTITUTES</div>${subs.map(row).join("")}` : ""}</div>`;
  };
  return `<div class="lu-grid">${team(h.hs === "me" ? m.lu : m.luOpp, h.hs)}${team(h.as === "me" ? m.lu : m.luOpp, h.as)}</div>`;
}

function vTable() {
  const s = ST.season || D.seasonList[0];
  const st = standing(s, ST.tcomp, false);
  return band("STANDINGS", "順位表", true) + `<div class="wrap narrow">
    ${st && st.comps.length > 1 ? `<div class="pills" id="tcomp">${st.comps.map(c => `<button class="pill${c === st.comp ? " on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${st ? sec(st.comp, s) + st.html : `<div class="panel">${empty("順位表はまだありません。")}</div>`}
    ${st && (D.rankHist[s + "\t" + st.comp] || []).length > 1 ? sec("POSITION", "順位の推移") + `<div class="chart">${rankChart(D.rankHist[s + "\t" + st.comp], D.table.filter(r => r.season === s && r.comp === st.comp).length)}</div>` : ""}
</div>`;
}
function bTable() { document.querySelectorAll("#tcomp .pill").forEach(b => b.onclick = () => { ST.tcomp = b.dataset.c; render(); }); }

function vStats(arg) {
  const s = ST.season, L = ofSeason(s), P = playerAgg(L);
  if (arg) {
    const M = PM.find(x => x.k === arg); if (!M) return `<div class="wrap">${empty("項目が見つかりません。")}</div>`;
    const R = ranked(P, M);
    return band("STATS", M.k, true) + `<div class="wrap narrow"><div class="panel rank-full">${R.map((x, i) => `<a class="rk-row" href="#/player/${encodeURIComponent(x.p.name)}"><span class="n">${i + 1}</span>${face(x.p.name)}
        <span class="nm">${esc(x.p.name)}<small style="display:block;color:var(--tx3);font-size:12px;font-weight:500">${esc(x.p.pos || "")}　${x.p.apps}試合</small></span><span class="val">${fmtN(x.v, M.d)}${M.u === "%" ? "%" : ""}</span></a>`).join("") || empty("該当する選手がいません。")}</div>
      <p class="back"><a class="btn" href="#/stats">STATS</a></p></div>`;
  }
  const cards = PM.map(M => rkCard(M, P)).filter(Boolean);
  const TM = teamMetrics(L), tg = {}; TM.forEach(x => (tg[x.g] = tg[x.g] || []).push(x));
  const GE = { 概要: "OVERVIEW", 攻撃: "ATTACK", パス: "PASSING", 守備: "DEFENCE", 規律: "DISCIPLINE" };
  return band("STATS", "記録", true) + `<div class="wrap">
    ${sec("PLAYER STATS", "選手記録")}
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
  const lbl = { GK: ["GOALKEEPERS", "ゴールキーパー"], DF: ["DEFENDERS", "ディフェンダー"], MF: ["MIDFIELDERS", "ミッドフィルダー"], FW: ["FORWARDS", "フォワード"], 他: ["OTHERS", "その他"] };
  const card = (p, isLoan) => { const a = byN[nameKey(p.name)] || {}, lc = isLoan ? loanClub(p.name) : "", ls = isLoan ? D.loans.filter(x => same(x.name, p.name) && (!s || x.season === s)).pop() : null;
    return `<a class="pcard${isLoan ? " loan" : ""}" href="#/player/${encodeURIComponent(p.name)}">
      <div class="ph-wrap">${p.no != null && !isLoan ? `<span class="no">${p.no}</span>` : ""}${isYouth(p) ? `<span class="acad">ACADEMY</span>` : ""}${face(p.name)}<span class="pos">${esc(p.pos || "")}</span></div>
      <div class="info"><b>${flag(p.nat)}${esc(p.name)}</b><small>${isLoan ? (lc ? `${esc(lc)}${leagueOf(lc) ? `（${esc(leagueOf(lc))}）` : ""}` : "期限付き移籍中") + (ls ? `<br>${ls.apps ?? 0}試合 ${ls.g ?? 0}得点 ${ls.a ?? 0}アシスト` : "")
        : a.apps ? `${a.apps}試合 ${a.g}得点 ${a.a}アシスト` : "出場なし"}</small></div></a>`; };
  const out = D.players.filter(p => /退団/.test(p.status));
  return band("PLAYERS", "選手", true) + `<div class="wrap">
    ${["GK", "DF", "MF", "FW", "他"].filter(k => G[k].length).map(k => sec(lbl[k][0], lbl[k][1]) + `<div class="pgrid">${G[k].sort((a, b) => (a.no ?? 999) - (b.no ?? 999)).map(p => card(p)).join("")}</div>`).join("") || `<div class="panel">${empty("選手情報はまだありません。")}</div>`}
    ${loan.length ? sec("ON LOAN", "期限付き移籍中の選手") + `<div class="pgrid">${loan.map(p => card(p, true)).join("")}</div>` : ""}
    ${staffBlock()}
    ${out.length ? sec("FORMER PLAYERS", "過去に在籍した選手") + `<div class="panel">${out.map(p => `<a class="prow" href="#/player/${encodeURIComponent(p.name)}"><span class="no"></span>${face(p.name)}<div class="nm"><b>${esc(p.name)}</b><small>${esc(p.pos)}</small></div></a>`).join("")}</div>` : ""}</div>`;
}

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
  const tiles = a ? [["出場", a.apps, "試合"], ["得点", a.g], ["アシスト", a.a], ["平均評価", a.rating != null ? fmtN(a.rating, 2) : null], ["出場時間", a.has["出場時間"] ? fmtN(a.min) : null, "分"], ["MOM", a.mom, "回"],
    ["ゴール期待値", a.s["ゴール期待値"] != null ? fmtN(a.s["ゴール期待値"], 2) : null], ["シュート", a.s["シュート"]], ["キーパス", a.s["キーパス"]],
    ["パス成功率", a.s["パス"] ? fmtN(a.s["パス成功"] / a.s["パス"] * 100, 1) : null, "%"], ["ドリブル成功", a.s["ドリブル成功"]], ["タックル成功", a.s["タックル成功"]],
    ["インターセプト", a.s["インターセプト"]], ["セーブ", a.s["セーブ"]], ["クリーンシート", /GK/.test(a.pos || p.pos) ? a.cs : null], ["警告", a.yc || null], ["退場", a.rc || null]].filter(x => x[1] != null && x[1] !== "") : [];
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
      ${p.no != null ? `<div class="bigno">${p.no}</div>` : ""}<h1>${esc(name)}</h1>${p.roma ? `<p class="roma">${esc(p.roma)}</p>` : ""}<div class="pos">${flag(p.nat)}${esc(p.pos || "")}${onLoan(p) ? "　期限付き移籍中" : /退団/.test(p.status || "") ? "　退団" : ""}</div>
      ${isYouth(p) ? `<span class="acad-tag">ACADEMY GRADUATE</span>` : ""}
    </div><div class="photo">${face(name)}</div></div></section>
  <div class="wrap">
    ${info.length ? sec("PROFILE", "プロフィール") + `<div class="prof p4" style="--n:${info.length}">${info.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
    ${p.memo ? `<p style="color:var(--tx2);margin:12px 0 0">${esc(p.memo)}</p>` : ""}
    ${playerFirsts(all)}${playerTitles(p, name, bySeason)}${playerHistory(p, name, bySeason)}
    <h2 class="sec"><b>SEASON STATS</b><small>シーズン成績</small><span style="margin-left:auto">${seasonSel()}</span></h2>
    ${tiles.length ? `<div class="tiles">${tiles.map(([k, v, u]) => `<div class="tile"><span>${k}</span><b>${typeof v === "number" ? fmtN(v) : esc(v)}${u ? `<small>${u}</small>` : ""}</b></div>`).join("")}</div>` : `<div class="panel">${empty("このシーズンの出場はありません。")}</div>`}
    ${ratings.length ? sec("RATING", "試合ごとの評価") + `<div class="chart">${ratingChart(ratings.slice(-30))}</div>` : ""}
    ${ovrChart ? sec("GROWTH", "能力値の推移") + `<div class="chart">${ovrChart}</div>` : ""}
    ${valChart ? sec("MARKET VALUE", "市場価値の推移") + `<div class="chart">${valChart}</div>` : ""}
    ${matches.length ? sec("MATCHES", "出場試合") + `<div class="panel">
      ${matches.slice(0, 40).map(({ m, l }) => `<a class="mrow" href="#/match/${m.id}"><div class="d"><b>${dotD(m.date)}</b><span>${esc(m.comp)}</span></div>
        <div class="t">${logo(m.opp, "md")}<div><small>${esc(l.pos)}${l.s["出場時間"] != null ? `　${l.s["出場時間"]}分` : l.role !== "先発" ? "　途中出場" : ""}${l.s["得点"] ? `　${l.s["得点"]}得点` : ""}${l.s["アシスト"] ? `　${l.s["アシスト"]}アシスト` : ""}</small>
        <b>${esc(m.opp)}　<span class="res ${m.res}" style="min-width:auto;height:22px;font-size:15px">${m.gf}-${m.ga}</span></b></div></div>
        <div class="s">${rt(l.rating)}</div></a>`).join("")}</div>` : ""}
    ${bySeason.length ? sec("CAREER", "シーズン別成績") + `<div class="tw"><table class="t"><thead><tr><th class="l" style="padding-left:16px">シーズン</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th><th>MOM</th></tr></thead><tbody>
      ${bySeason.map(({ se, x }) => `<tr><td class="l" style="padding-left:16px">${esc(se)}</td><td>${x.apps}</td><td>${x.g}</td><td>${x.a}</td><td>${rt(x.rating)}</td><td>${x.mom}</td></tr>`).join("")}
      ${all && bySeason.length > 1 ? `<tr class="me"><td class="l" style="padding-left:16px">通算</td><td>${all.apps}</td><td>${all.g}</td><td>${all.a}</td><td>${rt(all.rating)}</td><td>${all.mom}</td></tr>` : ""}</tbody></table></div>` : ""}
    ${(() => { const LL = D.loans.filter(x => same(x.name, name)); if (!LL.length) return "";
      return sec("LOAN", "期限付き移籍先での成績") + `<div class="tw"><table class="t"><thead><tr><th class="l" style="padding-left:16px">シーズン</th><th class="l">クラブ</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th><th>更新日</th></tr></thead><tbody>
        ${LL.map(x => `<tr><td class="l" style="padding-left:16px">${esc(x.season)}</td><td class="club l"><div>${logo(x.club, "sm")}<span>${esc(x.club)}${leagueOf(x.club) ? `<small style="display:block;color:var(--tx3);font-weight:500;font-size:11px">${esc(leagueOf(x.club))}</small>` : ""}</span></div></td>
          <td>${x.apps ?? ""}</td><td>${x.g ?? ""}</td><td>${x.a ?? ""}</td><td>${rt(x.rating)}</td><td>${dotY(x.date)}</td></tr>`).join("")}</tbody></table></div>`; })()}
    ${tr.length ? sec("TRANSFER", "移籍歴") + `<div class="tblock">${tr.map(trRow).join("")}</div>` : ""}
    <p class="back"><a class="btn" href="#/squad">PLAYERS</a></p></div>`;
}

/* このチームでの初出場・初得点・初アシスト */
function playerFirsts(all) {
  if (!all) return "";
  const L = [...all.list].sort((x, y) => (x.m.date || 0) - (y.m.date || 0)), k = nameKey(all.name);
  const g = o => o.l.s["得点"] || (o.m._sc && o.m._sc[k]) || 0, as = o => o.l.s["アシスト"] || (o.m._as && o.m._as[k]) || 0;
  const F3 = [["初出場", L[0]], ["初得点", L.find(o => g(o) > 0)], ["初アシスト", L.find(o => as(o) > 0)]];
  return sec("FIRSTS", `${clubName()}での初記録`) + `<div class="firsts">${F3.map(([t, o]) => o
    ? `<a href="#/match/${o.m.id}"><span>${t}</span><b>${fmtD(o.m.date)}</b><small>${esc(o.m.comp || "")}${o.m.round ? " " + esc(o.m.round) : ""}</small><small>vs ${esc(o.m.opp)}　${o.m.gf}-${o.m.ga}</small></a>`
    : `<div class="none"><span>${t}</span><b>-</b><small>まだ記録はありません</small></div>`).join("")}</div>`;
}
/* 在籍していたシーズン */
function memberSeasons(p, name, bySeason) {
  const S = new Set(bySeason.map(o => o.se));
  const outs = D.trans.filter(t => same(t.name, name) && t.kind === "退団").map(t => t.season).filter(Boolean).sort();
  const end = /退団/.test(p.status || "") && outs.length ? outs[outs.length - 1] : null;
  if (p.joined) D.seasons.forEach(x => { if (x.season >= p.joined && (!end || x.season <= end)) S.add(x.season); });
  return S;
}
function playerTitles(p, name, bySeason) {
  const S = memberSeasons(p, name, bySeason), team = {}, ind = {};
  D.seasons.filter(x => S.has(x.season)).forEach(x => String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean).forEach(t => (team[t] = team[t] || []).push(x.season)));
  (D.awards || []).filter(a => same(a.name, name)).forEach(a => { const t = (a.comp ? a.comp + "\u0001" : "") + a.title; (ind[t] = ind[t] || []).push(a.season || ""); });
  const box = (o, empTxt) => Object.keys(o).length ? `<div class="trophies">${Object.keys(o).map(t => `<div class="trophy">${ICON.cup}${t.includes("\u0001") ? `<span class="tr-comp">${esc(t.split("\u0001")[0])}</span>` : ""}<b>${esc(t.split("\u0001").pop())}</b><small>${o[t].sort().map(esc).join("、")}</small><span class="cnt">${o[t].length}</span></div>`).join("")}</div>` : `<div class="panel">${empty(empTxt)}</div>`;
  return sec("TITLES", "獲得タイトル") + `<h3 class="sub">チームタイトル</h3>${box(team, "まだタイトルはありません。")}<h3 class="sub">個人タイトル</h3>${box(ind, "まだ個人タイトルはありません。")}`;
}
/* チーム歴 */
function playerHistory(p, name, bySeason) {
  const me = clubName(), R = [];
  const T = D.trans.filter(t => same(t.name, name)).sort((a, b) => (a.date || 0) - (b.date || 0) || String(a.season).localeCompare(String(b.season)));
  const promo = T.find(t => t.kind === "ユース昇格");
  /* 小学・中学・高校（年は生年月日から。早生まれは1年早く入学） */
  const y0 = p.birth ? p.birth.getFullYear() + ((p.birth.getMonth() < 3 || (p.birth.getMonth() === 3 && p.birth.getDate() === 1)) ? 0 : 1) : null;
  (p.schools || []).forEach(([lb, v, a, n]) => { if (v) { const own = v.includes(me); R.push({ p: y0 ? `${y0 + a}〜${y0 + a + n}` : lb, c: v, lg: own ? me : "", note: own ? "" : lb, school: !own }); } });
  if ((/ユース/.test(p.origin || "") || promo) && !(p.schools || []).some(x => x[0] === "高校" && x[1])) R.push({ p: `${y0 ? y0 + 15 : ""}〜${promo ? promo.season : p.joined || ""}`, c: me + " ユース", lg: me, note: "" });
  let cur = { p0: (promo && promo.season) || p.joined || (bySeason.length ? bySeason[bySeason.length - 1].se : ""), c: me, note: "" };
  const close = (to) => { if (cur) { R.push({ p: `${cur.p0}〜${to || ""}`, c: cur.c, note: cur.note }); cur = null; } };
  T.forEach(t => {
    if (t.kind === "レンタル移籍" && t.club) { close(t.season); cur = { p0: t.season, c: t.club, note: "期限付き移籍" }; }
    else if (t.kind === "レンタル復帰") { close(t.season); cur = { p0: t.season, c: me, note: "" }; }
    else if (t.kind === "退団") { close(t.season); if (t.club) cur = { p0: t.season, c: t.club, note: "完全移籍" }; }
  });
  D.loans.filter(x => same(x.name, name) && x.club && !T.some(t => t.kind === "レンタル移籍" && same(t.club, x.club)))
    .forEach(x => { if (!R.concat(cur ? [{ c: cur.c }] : []).some(r => same(r.c, x.club))) R.push({ p: x.season, c: x.club, note: "期限付き移籍" }); });
  if (cur) R.push({ p: `${cur.p0}〜`, c: cur.c, note: cur.note });
  if (!R.length) return "";
  return sec("HISTORY", "チーム歴") + `<ol class="hist">${R.map(r => `<li><span>${esc(r.p)}</span>${r.school ? `<i class="hist-dot"></i>` : logo(r.lg || r.c, "sm")}<b>${esc(r.c)}${leagueOf(r.c) ? `<small>${esc(leagueOf(r.c))}</small>` : ""}</b>${r.note ? `<em${r.school ? ' class="sc"' : ""}>${esc(r.note)}</em>` : ""}</li>`).join("")}</ol>`;
}

const IN_KINDS = /^(加入|レンタル加入|レンタル復帰|ユース昇格)$/, OUT_KINDS = /^(退団|レンタル移籍)$/;
const KIND_TXT = { レンタル加入: "期限付き加入", レンタル移籍: "期限付き移籍", レンタル復帰: "復帰", ユース昇格: "昇格", 契約延長: "契約更新" };
function trRow(t) {
  const cls = IN_KINDS.test(t.kind) ? "in" : OUT_KINDS.test(t.kind) ? "out" : "etc";
  const cl = t.club ? t.club + (leagueOf(t.club) ? `（${leagueOf(t.club)}）` : "") : "";
  const from = cls === "in" ? (cl ? `前所属：${cl}` : "") : cls === "out" ? (cl ? `${t.kind === "レンタル移籍" ? "期限付き移籍先" : "移籍先"}：${cl}` : "") : cl;
  return `<div class="trow"><a class="who" href="#/player/${encodeURIComponent(t.name)}">${face(t.name)}<div><b><span class="kind ${cls}">${esc(KIND_TXT[t.kind] || t.kind)}</span>${esc(t.name)}</b>
    <small>${[t.pos, t.age != null ? t.age + "歳" : "", from, t.memo].filter(Boolean).map(esc).join("　")}</small></div></a>
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

function vClub() {
  const titles = [];
  D.seasons.forEach(x => String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean).forEach(t => titles.push({ t, s: x.season })));
  const tc = {}; titles.forEach(x => (tc[x.t] = tc[x.t] || []).push(x.s));
  const all = record(D.played), P = playerAgg(D.played);
  const big = [...D.played].sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const recs = [[PM[0], "通算得点"], [PM[1], "通算アシスト"], [PM[5], "通算出場"]].map(([M, l]) => rkCard(M, P, l)).filter(Boolean);
  const pol = Object.keys(D.conf).filter(k => /^方針\s*\d*$/.test(k)).sort((x, y) => (parseInt(x.replace(/\D/g, "")) || 0) - (parseInt(y.replace(/\D/g, "")) || 0)).map(k => D.conf[k]).filter(Boolean);
  const mgr = staffList().find(p => p.role === "監督"), founded = D.conf["創設年"], sl = D.conf["スローガン"];
  return band("CLUB", "クラブ") + `<section class="club-hero"><div class="club-hero-in">${logo(clubName(), "xl")}<div>
      <p class="kv-lab">${founded ? `EST. ${esc(founded)}` : "CLUB"}</p><h2>${esc(clubName())}</h2>
      ${sl ? `<p class="club-sl"><small>CLUB SLOGAN</small>${slogan(sl)}</p>` : ""}</div></div></section>
    ${identity()}<div class="wrap">
    ${pol.length ? sec("PHILOSOPHY", "クラブの方針") + `<ol class="policy">${pol.map((p, i) => `<li><b>${pad(i + 1)}</b><span>${esc(p)}</span></li>`).join("")}</ol>` : ""}
    ${mgr ? sec("MANAGER", "監督") + `<div class="mgr">${face(mgr.name)}<div><span>MANAGER</span><b>${flag(mgr.nat)}${esc(mgr.name)}</b>${mgr.memo ? `<p>${esc(mgr.memo)}</p>` : ""}
      <a class="btn" href="#/squad">STAFF</a></div></div>` : ""}
    ${sec("TITLES", "獲得タイトル")}${Object.keys(tc).length ? `<div class="trophies">${Object.keys(tc).map(t => `<div class="trophy">${ICON.cup}<b>${esc(t)}</b><small>${tc[t].map(esc).join("、")}</small><span class="cnt">${tc[t].length}</span></div>`).join("")}</div>` : `<div class="panel">${empty("まだタイトルはありません。")}</div>`}
    ${sec("ALL-TIME", "通算成績")}${all.n ? `<div class="tiles"><div class="tile"><span>試合</span><b>${all.n}</b></div><div class="tile"><span>成績</span><b class="rec">${all.w}<small>勝</small>${all.d}<small>分</small>${all.l}<small>敗</small></b></div>
      <div class="tile"><span>得点</span><b>${all.gf}</b></div><div class="tile"><span>失点</span><b>${all.ga}</b></div><div class="tile"><span>勝率</span><b>${fmtN(all.w / all.n * 100, 1)}<small>%</small></b></div>
      ${big ? `<div class="tile"><span>最多得点差勝利</span><b>${big.gf}-${big.ga}</b><em>${esc(big.opp)}　${dotY(big.date)}</em></div>` : ""}</div>` : `<div class="panel">${empty("まだ試合がありません。")}</div>`}
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
  const V = { home: vHome, news: vNews, matches: vMatches, match: vMatch, table: vTable, stats: vStats, squad: vSquad, player: vPlayer, transfers: vTransfers, club: vClub, history: vClub };
  const B = { news: bNews, matches: bMatches, match: bMatch, table: bTable };
  const view = $("view");
  view.innerHTML = (V[page] || vHome)(arg);
  (B[page] || (() => { }))();
  bindTips(view);
  const navKey = { match: "matches", table: "matches", stats: "matches", player: "squad", transfers: "squad", history: "club" }[page] || page;
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.p === navKey));
  fillSeason();
}
function setMenu(open) { $("tabs").classList.toggle("open", open); $("menu-btn").setAttribute("aria-expanded", open); }
let lastPage = "";
window.addEventListener("hashchange", () => { const p = location.hash; if (!/^#\/match\//.test(p)) ST.mtab = "facts"; if (p !== lastPage) window.scrollTo(0, 0); lastPage = p; setMenu(false); render(); });

(async function init() {
  $("menu-btn").onclick = () => setMenu(!$("tabs").classList.contains("open"));
  try { await loadAll(); } catch (e) { console.error(e); D.err = "データを読み込めませんでした。"; }
  document.title = clubName();
  ["brand-name", "foot-name", "copy-name"].forEach(id => $(id).textContent = clubName());
  if (D.conf["創設年"]) $("copy-year").textContent = D.conf["創設年"];
  if (D.conf["サブタイトル"]) $("brand-sub").textContent = D.conf["サブタイトル"];
  $("brand-logo").innerHTML = logo(clubName()); $("foot-logo").innerHTML = logo(clubName());
  render();
})();
