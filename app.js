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
  gr:    ["能力推移", 8],
  tr:    ["移籍", 9],
  tb:    ["順位表", 10],
  ox:    ["他クラブの試合", 13],
  ss:    ["シーズン", 11]
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
function age(birth, at) { if (!birth) return null; const t = at || new Date(); let a = t.getFullYear() - birth.getFullYear(); if (t.getMonth() < birth.getMonth() || (t.getMonth() === birth.getMonth() && t.getDate() < birth.getDate())) a--; return a; }

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
const D = { rankHist: {}, conf: {}, matches: [], played: [], players: [], growth: [], trans: [], table: [], seasons: [], lineups: [], seasonList: [], err: "" };
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
  const col = D.conf["テーマカラー"]; if (/^#[0-9a-f]{3,8}$/i.test(col || "")) document.documentElement.style.setProperty("--me", col);

  D.players = got.pl.map(o => ({
    name: F(o, "名前"), no: num(F(o, "背番号")), pos: F(o, "ポジション").toUpperCase(), nat: F(o, "国籍"), birth: pDate(F(o, "生年月日")),
    foot: F(o, "利き足"), height: num(F(o, "身長")), ovr: num(F(o, "総合値")), pot: num(F(o, "ポテンシャル")), value: num(F(o, "市場価値")),
    joined: F(o, "加入"), status: F(o, "在籍") || "在籍", photo: F(o, "写真"), memo: F(o, "メモ")
  })).filter(p => p.name);

  D.matches = got.match.map((o, i) => {
    const opp = F(o, "相手"); if (!opp) return null;
    const gf = num(F(o, "得点")), ga = num(F(o, "失点")), played = gf != null && ga != null, pk = parsePK(F(o, "PK"));
    const res = !played ? "U" : gf > ga ? "W" : gf < ga ? "L" : pk ? (pk.a > pk.b ? "W" : "L") : "D";
    let ha = F(o, "H/A").toUpperCase(); ha = /^A/.test(ha) ? "A" : /^N/.test(ha) ? "N" : "H";
    const date = pDate(F(o, "日付"));
    return { i, season: F(o, "シーズン"), date, key: dKey(date), comp: F(o, "大会") || "試合", round: F(o, "節・ラウンド"), ha, opp, gf, ga, pk, res, played,
      scorers: parseNames(F(o, "得点者")), assists: parseNames(F(o, "アシスト")), mom: F(o, "MOM"), stadium: F(o, "スタジアム"), att: num(F(o, "観客数")),
      memo: F(o, "メモ"), ts: {}, form: {}, lu: [], ev: [] };
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
    const l = { i, m, name, role: F(o, "出場") || "先発", no: num(F(o, "背番号")), pos: F(o, "ポジション").toUpperCase(), s, rating: s["評価"] ?? null };
    if (l.role !== "ベンチ") m.lu.push(l);
    return l;
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
    if (!m.mom) { const r = m.lu.filter(l => l.rating != null).sort((a, b) => b.rating - a.rating)[0]; if (r) { m.mom = r.name; m.momAuto = true; } }
  });
  D.played = D.matches.filter(m => m.played);

  D.growth = got.gr.map(o => ({ date: pDate(F(o, "日付")), season: F(o, "シーズン"), name: F(o, "名前"), ovr: num(F(o, "総合値")), pot: num(F(o, "ポテンシャル")), value: num(F(o, "市場価値")) }))
    .filter(g => g.name && (g.ovr != null || g.pot != null)).sort((a, b) => (a.date || 0) - (b.date || 0));
  D.trans = got.tr.map((o, i) => ({ i, season: F(o, "シーズン"), date: pDate(F(o, "日付")), kind: F(o, "区分") || "加入", name: F(o, "名前"), pos: F(o, "ポジション").toUpperCase(),
    age: num(F(o, "年齢")), club: F(o, "相手クラブ"), fee: num(F(o, "移籍金")), memo: F(o, "メモ") })).filter(t => t.name);
  D.table = got.tb.map(o => ({ season: F(o, "シーズン"), comp: F(o, "大会"), rank: num(F(o, "順位")), club: F(o, "クラブ"), p: num(F(o, "試合")), w: num(F(o, "勝")),
    d: num(F(o, "分")), l: num(F(o, "負")), gf: num(F(o, "得点")), ga: num(F(o, "失点")), pts: num(F(o, "勝点")) })).filter(r => r.club);
  /* 他クラブの試合が入っている大会は、自分の試合と合わせて順位表を自動で計算する（順位表シートより優先） */
  const ox = got.ox.map(o => ({ season: F(o, "シーズン"), date: pDate(F(o, "日付")), comp: F(o, "大会"), home: F(o, "ホーム"), away: F(o, "アウェイ"), hg: num(F(o, "ホーム得点")), ag: num(F(o, "アウェイ得点")) }))
    .filter(r => r.home && r.away && r.hg != null && r.ag != null);
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
  D.seasons = got.ss.map(o => ({ season: F(o, "シーズン"), league: F(o, "リーグ"), rank: num(F(o, "リーグ順位")), titles: F(o, "獲得タイトル"), cap: F(o, "主将"), comment: F(o, "一言") })).filter(s => s.season);

  const ss = new Set([...D.matches, ...D.trans, ...D.table, ...D.seasons].map(x => x.season).filter(Boolean));
  if (!ss.size && D.conf["最初のシーズン"]) ss.add(D.conf["最初のシーズン"]);
  D.seasonList = [...ss].sort().reverse();
  if (!D.seasonList.length) D.seasonList = [curSeason()];
  const last = D.played[D.played.length - 1];
  ST.season = ST.cur = (last && last.season) || D.seasonList[0];
}
/* 今のシーズン（7月はじまり。例：2026年11月 → 2026-27） */
function curSeason() { const t = new Date(), y = t.getFullYear(); return t.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; }
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
function imgTag(cands, alt, cls, key) {
  const list = IMG_OK[key] ? [IMG_OK[key]] : cands;
  if (IMG_OK[key] === false || !list.length) return `<div class="${cls} ph" role="img" aria-label="${esc(alt)}">${esc(initials(alt))}</div>`;
  return `<img class="${cls}" src="${esc(encodeURI(list[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async" data-k="${esc(key)}" data-c="${esc(list.slice(1).join("|"))}"
    data-i="${esc(initials(alt))}" onload="imgOk(this)" onerror="imgNext(this)">`;
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
  return imgTag(imgCands("logo", names), me ? clubName() : club, "logo " + (cls || ""), "l:" + (me ? "__me" : nameKey(club)));
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
  const W = 640, H = 200, pl = 30, pr = 118, pt = 12, pb = 24;
  const xs = all.map(p => +p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v)); lo = Math.floor((lo - 2) / 5) * 5; hi = Math.ceil((hi + 1) / 5) * 5;
  const X = v => pl + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}">`;
  for (let v = lo; v <= hi; v += 5) s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  const ticks = [...new Set(all.map(p => fmtD(p.x)))].map(t => all.find(p => fmtD(p.x) === t).x);
  ticks.forEach((t, i) => { if (ticks.length <= 6 || i % Math.ceil(ticks.length / 6) === 0) s += `<text class="ax" x="${X(+t)}" y="${H - 6}" text-anchor="middle">${t.getFullYear()}/${t.getMonth() + 1}</text>`; });
  series.forEach(sr => {
    if (!sr.pts.length) return;
    s += `<polyline fill="none" stroke="${sr.color}" stroke-width="2" ${sr.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" points="${sr.pts.map(p => `${X(+p.x)},${Y(p.v)}`).join(" ")}"/>`;
    sr.pts.forEach(p => s += `<circle cx="${X(+p.x)}" cy="${Y(p.v)}" r="4" fill="${sr.color}" stroke="#fff" stroke-width="2"/><circle class="hit" cx="${X(+p.x)}" cy="${Y(p.v)}" r="12" data-tip="${esc(p.tip)}"/>`);
    const lp = sr.pts[sr.pts.length - 1];
    s += `<text x="${X(+lp.x) + 9}" y="${Y(lp.v) + 4}" fill="#1c2833" font-size="12" font-weight="700">${esc(sr.name)} ${lp.v}</text>`;
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
    <div class="t">${logo(m.opp, "md")}<div><small>${esc(roundTxt(m))}</small><b><span class="ha ${m.ha}">${m.ha}</span>${esc(m.opp)}</b></div></div>
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
    ${rows.map(r => `<tr class="${isMe(r.club) ? "me" : ""}"><td class="pos">${r.rank ?? ""}</td><td class="club l"><div>${logo(r.club, "sm")}<span>${esc(r.club)}</span></div></td><td>${r.p ?? ""}</td>
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
function buildNews() {
  const N = [];
  D.played.forEach(m => N.push({ d: m.date, cat: "MATCH", t: `${roundTxt(m)} ${m.opp}戦 試合結果`, href: `#/match/${m.id}`, season: m.season }));
  const nx = D.matches.find(m => !m.played), lp = D.played[D.played.length - 1];
  if (nx) N.push({ d: lp ? lp.date : nx.date, cat: "MATCH", t: `${roundTxt(nx)} ${nx.opp}戦 試合情報`, href: `#/match/${nx.id}`, season: nx.season, top: 1 });
  const TT = { 加入: n => `${n}選手 加入のお知らせ`, レンタル加入: n => `${n}選手 期限付き移籍加入のお知らせ`, レンタル復帰: n => `${n}選手 期限付き移籍からの復帰のお知らせ`,
    ユース昇格: n => `${n}選手 トップチーム昇格のお知らせ`, 契約延長: n => `${n}選手 契約更新のお知らせ`,
    退団: (n, c) => c ? `${n}選手 ${c}へ完全移籍のお知らせ` : `${n}選手 退団のお知らせ`, レンタル移籍: (n, c) => `${n}選手 ${c ? c + "へ" : ""}期限付き移籍のお知らせ` };
  D.trans.forEach(t => N.push({ d: t.date, cat: "TRANSFER", t: (TT[t.kind] || (n => `${n}選手 ${t.kind}のお知らせ`))(t.name, t.club), href: `#/player/${encodeURIComponent(t.name)}`, season: t.season }));
  D.seasons.forEach(s => {
    const last = D.played.filter(m => m.season === s.season).pop();
    String(s.titles || "").split(/[、,，\/／]/).map(x => x.trim()).filter(Boolean).forEach(t => N.push({ d: last && last.date, cat: "CLUB", t: `${t} 優勝のお知らせ`, href: "#/history", season: s.season, top: 1 }));
  });
  return N.filter(n => n.d).sort((a, b) => b.d - a.d || (b.top || 0) - (a.top || 0));
}
const newsList = L => `<div class="news">${L.map(n => `<a href="${n.href}"><time>${dotY(n.d)}</time><span class="cat c-${n.cat}">${n.cat}</span><b>${esc(n.t)}</b></a>`).join("")}</div>`;

/* =====================================================================
   ページ
   ===================================================================== */
function vHome() {
  const s = ST.cur, L = ofSeason(s), r = record(L);
  const next = D.matches.find(m => !m.played && (!s || m.season === s)) || D.matches.find(m => !m.played);
  const lastM = L[L.length - 1];
  const P = playerAgg(L);
  const st = standing(s, null, true);
  const myRank = (D.table.find(t => t.season === s && isMe(t.club)) || {}).rank;
  const clubBox = c => `<div class="club">${logo(c, "lg")}<span>${esc(c)}</span></div>`;
  const nextHtml = next ? (() => { const h = homeAway(next); return `<div class="nm-card"><p class="hero-lab">NEXT MATCH</p><div class="nm-comp">${esc(roundTxt(next))}</div>
      <div class="nm-date"><b>${dotD(next.date)}</b><span>${next.date ? WDE[next.date.getDay()] : ""}</span>${kickoff(next) ? `<em>${kickoff(next)}</em>` : ""}</div>
      <div class="nm-vs">${clubBox(h.home)}<span class="v">VS</span>${clubBox(h.away)}</div>
      <div class="nm-venue">${venue(next) ? esc(venue(next)) : next.ha === "H" ? "HOME" : next.ha === "A" ? "AWAY" : ""}</div>
      <a class="btn w" href="#/match/${next.id}">MATCH INFO</a></div>`; })()
    : `<div class="hero-club">${logo(clubName(), "xl")}<div><p class="hero-lab">${esc(s)} SEASON</p><h1 class="hero-name">${esc(clubName())}</h1>${D.conf["リーグ"] ? `<p class="hero-sub">${esc(D.conf["リーグ"])}</p>` : ""}</div></div>`;
  const lr = lastM ? (() => { const h = homeAway(lastM); return `<a class="lr" href="#/match/${lastM.id}"><p class="hero-lab">LATEST RESULT</p><div class="lr-comp">${esc(roundTxt(lastM))}・${dotY(lastM.date)}</div>
      <div class="lr-score"><div class="club">${logo(h.home, "md")}<span>${esc(h.home)}</span></div><b>${scoreTxt(lastM)}</b><div class="club">${logo(h.away, "md")}<span>${esc(h.away)}</span></div></div>
      <div class="lr-sc">${lastM.scorers.map(x => esc(x.name) + (x.n > 1 ? ` ×${x.n}` : "")).join("、")}</div></a>`; })() : "";
  const news = buildNews().slice(0, 6);
  const recent = [...L.slice(-4), ...D.matches.filter(m => !m.played && (!s || m.season === s)).slice(0, 2)];
  const tops = [[PM[0], "得点ランキング"], [PM[1], "アシストランキング"], [PM[3], "平均評価"]].map(([Mx, lb]) => rkCard(Mx, P, lb)).filter(Boolean);
  const po = teamAvg(L, "me", "ボール支配率");
  return `<section class="hero"><div class="hero-in">${nextHtml}${lr}</div></section>
  <div class="wrap">${D.err ? `<div class="err">${esc(D.err)}</div>` : ""}
  <div class="grid"><div>
    ${news.length ? sec("NEWS", "ニュース", "#/news") + newsList(news) : ""}
    ${sec("MATCHES", "試合日程・結果", "#/matches")}${recent.length ? `<div class="mlist">${recent.map(matchRow).join("")}</div>` : `<div class="panel">${empty("試合日程はまだありません。")}</div>`}
  </div><div>
    ${st ? sec("STANDINGS", st.comp, "#/table") + st.html : ""}
    ${sec("SEASON", seasonLabel(s))}
    ${r.n ? `<div class="tiles" style="grid-template-columns:1fr 1fr">
      <div class="tile"><span>成績</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div>
      ${myRank ? `<div class="tile"><span>順位</span><b>${myRank}<small>位</small></b></div>` : `<div class="tile"><span>勝点</span><b>${r.pts}</b></div>`}
      <div class="tile"><span>得点</span><b>${r.gf}</b></div><div class="tile"><span>失点</span><b>${r.ga}</b></div>
      <div class="tile"><span>直近5試合</span><b class="form5" style="margin-top:8px">${L.slice(-5).map(wdl).join("")}</b></div>
      ${po ? `<div class="tile"><span>平均支配率</span><b>${fmtN(po.avg, 1)}<small>%</small></b></div>` : `<div class="tile"><span>クリーンシート</span><b>${r.cs}</b></div>`}
    </div>` : `<div class="panel">${empty("まだ試合がありません。")}</div>`}
  </div></div>
  ${tops.length ? sec("TOP PLAYERS", "チーム内ランキング", "#/stats") + `<div class="sgrid sgrid3">${tops.join("")}</div>` : ""}
  </div>`;
}

function vNews() {
  const all = buildNews(), cats = ["ALL", ...new Set(all.map(n => n.cat))];
  if (!cats.includes(ST.ncat)) ST.ncat = "ALL";
  const L = all.filter(n => ST.ncat === "ALL" || n.cat === ST.ncat);
  return band("NEWS", "ニュース") + `<div class="wrap narrow">
    <div class="pills" id="ncat">${cats.map(c => `<button class="pill${c === ST.ncat ? " on" : ""}" data-c="${c}">${c}</button>`).join("")}</div>
    ${L.length ? newsList(L.slice(0, 80)) : `<div class="panel">${empty("ニュースはまだありません。")}</div>`}</div>`;
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
  const mom = m.mom ? (() => { const l = m.lu.find(x => same(x.name, m.mom)); return `<div class="ph">MAN OF THE MATCH</div><a class="prow" href="#/player/${encodeURIComponent(m.mom)}"><span class="no">${l && l.no != null ? l.no : ""}</span>${face(m.mom)}<div class="nm"><b>${esc(m.mom)}</b><small>${esc(l ? l.pos : "")}</small></div>${l ? rt(l.rating) : ""}</a>`; })() : "";
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
    <div class="cmp-legend"><span><i style="background:var(--cl)"></i>${esc(H === "me" ? clubName() : m.opp)} ${fm(H)}</span><span>${fm(A)} ${esc(A === "me" ? clubName() : m.opp)}<i style="background:var(--cr)"></i></span></div>
    ${poss}${body}</div>`;
}
const POSXY = { GK: [50, 91], SW: [50, 82], RB: [86, 72], RCB: [66, 78], CB: [50, 79], LCB: [34, 78], LB: [14, 72], RWB: [88, 60], LWB: [12, 60],
  CDM: [50, 64], RDM: [66, 64], LDM: [34, 64], CM: [50, 52], RCM: [70, 53], LCM: [30, 53], RM: [88, 46], LM: [12, 46], CAM: [50, 38], RAM: [70, 38], LAM: [30, 38],
  RW: [84, 24], LW: [16, 24], RF: [66, 20], LF: [34, 20], CF: [50, 22], ST: [50, 15], RS: [64, 15], LS: [36, 15] };
function matchLineup(m) {
  const XI = m.lu.filter(l => l.role === "先発"), subs = m.lu.filter(l => l.role !== "先発");
  if (!m.lu.length) return empty("メンバーの記録はありません。");
  const used = {};
  const pos = l => { const p = POSXY[l.pos] || POSXY[{ GK: "GK", DF: "CB", MF: "CM", FW: "ST" }[l.pos]] || [50, 50]; const k = p.join(); used[k] = (used[k] || 0) + 1; return [p[0] + (used[k] - 1) * 16 * (used[k] % 2 ? 1 : -1), p[1]]; };
  const gIcon = l => l.s["得点"] ? ICON.ball.repeat(Math.min(3, l.s["得点"])) : "";
  const pitch = XI.length ? `<div class="pitch">${XI.map(l => { const [x, y] = pos(l); return `<a class="pl" href="#/player/${encodeURIComponent(l.name)}" style="left:${x}%;top:${y}%">${face(l.name)}${rt(l.rating)}<span class="gl">${gIcon(l)}</span><span>${l.no != null ? l.no + " " : ""}${esc(l.name)}</span></a>`; }).join("")}</div>` : "";
  const row = l => `<a class="prow" href="#/player/${encodeURIComponent(l.name)}"><span class="no">${l.no ?? ""}</span>${face(l.name)}<div class="nm"><b>${esc(l.name)}</b><small>${esc(l.pos)}${l.s["出場時間"] != null ? `　${l.s["出場時間"]}分` : ""}${l.s["得点"] ? `　${l.s["得点"]}得点` : ""}${l.s["アシスト"] ? `　${l.s["アシスト"]}アシスト` : ""}</small></div>${rt(l.rating)}</a>`;
  return `<div class="ph">STARTING XI<small>${esc(m.form.me || "")}</small></div>${pitch}${XI.map(row).join("")}
    ${subs.length ? `<div class="ph">SUBSTITUTES</div>${subs.map(row).join("")}` : ""}`;
}

function vTable() {
  const s = ST.season || D.seasonList[0];
  const st = standing(s, ST.tcomp, false);
  return band("STANDINGS", "順位表", true) + `<div class="wrap narrow">
    ${st && st.comps.length > 1 ? `<div class="pills" id="tcomp">${st.comps.map(c => `<button class="pill${c === st.comp ? " on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${st ? sec(st.comp, s) + st.html : `<div class="panel">${empty("順位表はまだありません。")}</div>`}
    ${st && (D.rankHist[s + "\t" + st.comp] || []).length > 1 ? sec("POSITION", "順位の推移") + `<div class="chart">${rankChart(D.rankHist[s + "\t" + st.comp], D.table.filter(r => r.season === s && r.comp === st.comp).length)}</div>` : ""}
    ${historyBlock()}</div>`;
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
  const G = { GK: [], DF: [], MF: [], FW: [], 他: [] };
  list.forEach(p => G[POSCAT(p.pos)].push(p));
  const lbl = { GK: ["GOALKEEPERS", "ゴールキーパー"], DF: ["DEFENDERS", "ディフェンダー"], MF: ["MIDFIELDERS", "ミッドフィルダー"], FW: ["FORWARDS", "フォワード"], 他: ["OTHERS", "その他"] };
  const card = p => { const a = byN[nameKey(p.name)] || {}; return `<a class="pcard${/レンタル/.test(p.status) ? " loan" : ""}" href="#/player/${encodeURIComponent(p.name)}">
      <div class="ph-wrap">${p.no != null ? `<span class="no">${p.no}</span>` : ""}${face(p.name)}<span class="pos">${esc(p.pos || "")}</span></div>
      <div class="info"><b>${esc(p.name)}</b><small>${/レンタル/.test(p.status) ? "期限付き移籍中" : a.apps ? `${a.apps}試合 ${a.g}得点 ${a.a}アシスト` : "出場なし"}</small></div></a>`; };
  const out = D.players.filter(p => /退団/.test(p.status));
  return band("PLAYERS", "選手", true) + `<div class="wrap">
    ${["GK", "DF", "MF", "FW", "他"].filter(k => G[k].length).map(k => sec(lbl[k][0], lbl[k][1]) + `<div class="pgrid">${G[k].sort((a, b) => (a.no ?? 999) - (b.no ?? 999)).map(card).join("")}</div>`).join("") || `<div class="panel">${empty("選手情報はまだありません。")}</div>`}
    ${D.conf["監督名"] ? sec("STAFF", "スタッフ") + `<div class="prof"><div><span>監督</span><b>${esc(D.conf["監督名"])}</b></div></div>` : ""}
    ${out.length ? sec("FORMER PLAYERS", "過去に在籍した選手") + `<div class="panel">${out.map(p => `<a class="prow" href="#/player/${encodeURIComponent(p.name)}"><span class="no"></span>${face(p.name)}<div class="nm"><b>${esc(p.name)}</b><small>${esc(p.pos)}</small></div></a>`).join("")}</div>` : ""}</div>`;
}

function vPlayer(name) {
  const p = prof(name) || { name, pos: "" };
  const s = ST.season, Ls = ofSeason(s), all = playerAgg(D.played).find(x => same(x.name, name));
  const a = playerAgg(Ls).find(x => same(x.name, name));
  const G = D.growth.filter(g => same(g.name, name));
  const lastG = G[G.length - 1] || {};
  const ovr = p.ovr ?? lastG.ovr, pot = p.pot ?? lastG.pot, val = p.value ?? lastG.value;
  const info = [["ポジション", p.pos], ["生年月日", p.birth ? `${fmtD(p.birth)}（${age(p.birth)}歳）` : ""], ["国籍", p.nat], ["身長", p.height ? p.height + "cm" : ""], ["利き足", p.foot],
    ["市場価値", money(val)], ["加入", p.joined]].filter(x => x[1]);
  const tiles = a ? [["出場", a.apps, "試合"], ["得点", a.g], ["アシスト", a.a], ["平均評価", a.rating != null ? fmtN(a.rating, 2) : null], ["出場時間", a.has["出場時間"] ? fmtN(a.min) : null, "分"], ["MOM", a.mom, "回"],
    ["ゴール期待値", a.s["ゴール期待値"] != null ? fmtN(a.s["ゴール期待値"], 2) : null], ["シュート", a.s["シュート"]], ["キーパス", a.s["キーパス"]],
    ["パス成功率", a.s["パス"] ? fmtN(a.s["パス成功"] / a.s["パス"] * 100, 1) : null, "%"], ["ドリブル成功", a.s["ドリブル成功"]], ["タックル成功", a.s["タックル成功"]],
    ["インターセプト", a.s["インターセプト"]], ["セーブ", a.s["セーブ"]], ["クリーンシート", /GK/.test(a.pos || p.pos) ? a.cs : null], ["警告", a.yc || null], ["退場", a.rc || null]].filter(x => x[1] != null && x[1] !== "") : [];
  const ratings = a ? a.list.filter(x => x.l.rating != null).map(x => ({ m: x.m, r: x.l.rating })) : [];
  const ovrChart = G.length >= 2 ? lineChart([
    { name: "総合値", color: "#2E86C8", pts: G.filter(g => g.ovr != null && g.date).map(g => ({ x: g.date, v: g.ovr, tip: `<b>${fmtD(g.date)}</b><br>総合値 ${g.ovr}${g.pot ? ` / ポテンシャル ${g.pot}` : ""}${g.value ? `<br>市場価値 ${money(g.value)}` : ""}` })) },
    { name: "ポテンシャル", color: "#D9702A", dash: true, pts: G.filter(g => g.pot != null && g.date).map(g => ({ x: g.date, v: g.pot, tip: `<b>${fmtD(g.date)}</b><br>ポテンシャル ${g.pot}` })) }
  ], { label: "総合値とポテンシャルの推移" }) : "";
  const bySeason = D.seasonList.map(se => ({ se, x: playerAgg(ofSeason(se)).find(q => same(q.name, name)) })).filter(o => o.x);
  const matches = a ? [...a.list].reverse() : [];
  const tr = D.trans.filter(t => same(t.name, name));
  return `<section class="phero"><div class="phero-in"><div>
      ${p.no != null ? `<div class="bigno">${p.no}</div>` : ""}<h1>${esc(name)}</h1><div class="pos">${esc(p.pos || "")}${/レンタル/.test(p.status || "") ? "　期限付き移籍中" : /退団/.test(p.status || "") ? "　退団" : ""}</div>
      ${ovr != null || pot != null ? `<div class="ovr">${ovr != null ? `<div><b>${ovr}</b><span>総合値</span></div>` : ""}${pot != null ? `<div><b>${pot}</b><span>ポテンシャル</span></div>` : ""}</div>` : `<div style="height:28px"></div>`}
    </div><div class="photo">${face(name)}</div></div></section>
  <div class="wrap">
    ${info.length ? sec("PROFILE", "プロフィール") + `<div class="prof">${info.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
    ${p.memo ? `<p style="color:var(--tx2);margin:12px 0 0">${esc(p.memo)}</p>` : ""}
    <h2 class="sec"><b>SEASON STATS</b><small>シーズン成績</small><span style="margin-left:auto">${seasonSel()}</span></h2>
    ${tiles.length ? `<div class="tiles">${tiles.map(([k, v, u]) => `<div class="tile"><span>${k}</span><b>${typeof v === "number" ? fmtN(v) : esc(v)}${u ? `<small>${u}</small>` : ""}</b></div>`).join("")}</div>` : `<div class="panel">${empty("このシーズンの出場はありません。")}</div>`}
    ${ratings.length ? sec("RATING", "試合ごとの評価") + `<div class="chart">${ratingChart(ratings.slice(-30))}</div>` : ""}
    ${ovrChart ? sec("GROWTH", "総合値の推移") + `<div class="chart">${ovrChart}</div>` : ""}
    ${matches.length ? sec("MATCHES", "出場試合") + `<div class="panel">
      ${matches.slice(0, 40).map(({ m, l }) => `<a class="mrow" href="#/match/${m.id}"><div class="d"><b>${dotD(m.date)}</b><span>${esc(m.comp)}</span></div>
        <div class="t">${logo(m.opp, "md")}<div><small>${esc(l.pos)}${l.s["出場時間"] != null ? `　${l.s["出場時間"]}分` : l.role !== "先発" ? "　途中出場" : ""}${l.s["得点"] ? `　${l.s["得点"]}得点` : ""}${l.s["アシスト"] ? `　${l.s["アシスト"]}アシスト` : ""}</small>
        <b>${esc(m.opp)}　<span class="res ${m.res}" style="min-width:auto;height:22px;font-size:15px">${m.gf}-${m.ga}</span></b></div></div>
        <div class="s">${rt(l.rating)}</div></a>`).join("")}</div>` : ""}
    ${bySeason.length ? sec("CAREER", "シーズン別成績") + `<div class="tw"><table class="t"><thead><tr><th class="l" style="padding-left:16px">シーズン</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th><th>MOM</th></tr></thead><tbody>
      ${bySeason.map(({ se, x }) => `<tr><td class="l" style="padding-left:16px">${esc(se)}</td><td>${x.apps}</td><td>${x.g}</td><td>${x.a}</td><td>${rt(x.rating)}</td><td>${x.mom}</td></tr>`).join("")}
      ${all && bySeason.length > 1 ? `<tr class="me"><td class="l" style="padding-left:16px">通算</td><td>${all.apps}</td><td>${all.g}</td><td>${all.a}</td><td>${rt(all.rating)}</td><td>${all.mom}</td></tr>` : ""}</tbody></table></div>` : ""}
    ${tr.length ? sec("TRANSFER", "移籍歴") + `<div class="tblock">${tr.map(trRow).join("")}</div>` : ""}
    <p class="back"><a class="btn" href="#/squad">PLAYERS</a></p></div>`;
}

const IN_KINDS = /^(加入|レンタル加入|レンタル復帰|ユース昇格)$/, OUT_KINDS = /^(退団|レンタル移籍)$/;
const KIND_TXT = { レンタル加入: "期限付き加入", レンタル移籍: "期限付き移籍", レンタル復帰: "復帰", ユース昇格: "昇格", 契約延長: "契約更新" };
function trRow(t) {
  const cls = IN_KINDS.test(t.kind) ? "in" : OUT_KINDS.test(t.kind) ? "out" : "etc";
  const from = cls === "in" ? (t.club ? `前所属：${t.club}` : "") : cls === "out" ? (t.club ? `移籍先：${t.club}` : "") : t.club;
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

function historyBlock() {
  if (!D.seasons.length) return "";
  return sec("HISTORY", "シーズンごとの成績") + `<div class="hist">${[...D.seasons].sort((a, b) => a.season < b.season ? 1 : -1).map(x => {
    const r = record(ofSeason(x.season));
    return `<div class="hist-row"><div><div class="s">${esc(x.season)}</div><small>${esc(x.league)}</small></div>
      <div>${x.titles ? `<div class="tt">${esc(x.titles)} 優勝</div>` : ""}<small>${r.n ? `${r.n}試合 ${r.w}勝${r.d}分${r.l}敗` : ""}${x.cap ? `　主将：${esc(x.cap)}` : ""}</small>${x.comment ? `<small>${esc(x.comment)}</small>` : ""}</div>
      <div class="rk">${x.rank != null ? `${x.rank}<small>位</small>` : ""}</div></div>`; }).join("")}</div>`;
}
function vHistory() {
  const titles = [];
  D.seasons.forEach(x => String(x.titles || "").split(/[、,，\/／]/).map(t => t.trim()).filter(Boolean).forEach(t => titles.push({ t, s: x.season })));
  const tc = {}; titles.forEach(x => (tc[x.t] = tc[x.t] || []).push(x.s));
  const all = record(D.played), P = playerAgg(D.played);
  const big = [...D.played].sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const info = [["クラブ名", clubName()], ["監督", D.conf["監督名"]], ["ホームスタジアム", D.conf["ホームスタジアム"]], ["リーグ", D.conf["リーグ"]], ["最初のシーズン", D.conf["最初のシーズン"]]].filter(x => x[1]);
  const recs = [[PM[0], "通算得点"], [PM[1], "通算アシスト"], [PM[5], "通算出場"]].map(([M, l]) => rkCard(M, P, l)).filter(Boolean);
  const pol = Object.keys(D.conf).filter(k => /^方針\s*\d*$/.test(k)).sort((x, y) => (parseInt(x.replace(/\D/g, "")) || 0) - (parseInt(y.replace(/\D/g, "")) || 0)).map(k => D.conf[k]).filter(Boolean);
  return band("CLUB", "クラブ") + `<div class="wrap">
    ${pol.length ? sec("PHILOSOPHY", "クラブの方針") + `<ol class="policy">${pol.map((p, i) => `<li><b>${pad(i + 1)}</b><span>${esc(p)}</span></li>`).join("")}</ol>` : ""}
    ${sec("PROFILE", "クラブ概要")}<div class="prof">${info.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
    ${Object.keys(tc).length ? sec("TITLES", "獲得タイトル") + `<div class="trophies">${Object.keys(tc).map(t => `<div class="trophy">${ICON.cup}<b>${esc(t)}</b><small>${tc[t].map(esc).join("、")}</small><span class="cnt">${tc[t].length}</span></div>`).join("")}</div>` : ""}
    ${all.n ? sec("ALL-TIME", "通算成績") + `<div class="tiles"><div class="tile"><span>試合</span><b>${all.n}</b></div><div class="tile"><span>成績</span><b>${all.w}<small>勝</small>${all.d}<small>分</small>${all.l}<small>敗</small></b></div>
      <div class="tile"><span>得点</span><b>${all.gf}</b></div><div class="tile"><span>失点</span><b>${all.ga}</b></div><div class="tile"><span>勝率</span><b>${fmtN(all.w / all.n * 100, 1)}<small>%</small></b></div>
      ${big ? `<div class="tile"><span>最多得点差勝利</span><b>${big.gf}-${big.ga}</b><em>${esc(big.opp)}　${dotY(big.date)}</em></div>` : ""}</div>` : ""}
    ${historyBlock()}
    ${recs.length ? sec("RECORDS", "通算記録") + `<div class="sgrid">${recs.join("")}</div>` : ""}</div>`;
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
  const V = { home: vHome, news: vNews, matches: vMatches, match: vMatch, table: vTable, stats: vStats, squad: vSquad, player: vPlayer, transfers: vTransfers, history: vHistory };
  const B = { news: bNews, matches: bMatches, match: bMatch, table: bTable };
  const view = $("view");
  view.innerHTML = (V[page] || vHome)(arg);
  (B[page] || (() => { }))();
  bindTips(view);
  const navKey = { match: "matches", player: "squad", news: "home" }[page] || page;
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
