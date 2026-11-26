/* 小物（文字・日付・数値）とスプシの読み込み */

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
