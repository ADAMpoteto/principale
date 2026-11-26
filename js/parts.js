/* 画像・エンブレム・クラブ情報など共通の部品 */

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
/* URL用：ローマ字を小文字・ハイフンつなぎに（なければ名前そのまま） */
const slugOf = r => String(r || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pslug = name => { const p = prof(name), sl = p && slugOf(p.roma); return sl ? sl : encodeURIComponent(name); };
/* URLから選手名に戻す（ローマ字・名前のどちらでも） */
const fromSlug = arg => { if (!arg) return arg; const p = D.players.find(q => slugOf(q.roma) === String(arg).toLowerCase()); return p ? p.name : arg; };
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
  return `<a class="pcard staff" href="#/staff/${pslug(p.name)}"><div class="ph-wrap">${face(p.name)}<span class="pos">${esc(p.role)}</span></div>
    <div class="info"><b>${flag(p.nat)}${esc(p.name)}</b><small>${[p.birth ? age(p.birth) + "歳" : "", p.memo].filter(Boolean).map(esc).join("　") || "&nbsp;"}</small></div></a>`;
}
const ROLE_EN = { 監督: "MANAGER", ヘッドコーチ: "HEAD COACH", コーチ: "COACH", GKコーチ: "GK COACH", フィジカルコーチ: "FITNESS COACH", アナリスト: "ANALYST", ユース監督: "ACADEMY MANAGER" };

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
const pLink = (name, inner) => `<a href="#/player/${pslug(name)}">${inner || esc(name)}</a>`;

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
/* ニュースの見出し用：「6節」は「第6節」に */
const roundTitle = m => [m.comp, /^\d+節$/.test(String(m.round || "").trim()) ? "第" + String(m.round).trim() : m.round].filter(Boolean).join(" ");
/* 画面表示用：大会名と節を2行に分ける */
const roundBr = m => `<span class="rb"><span>${esc(m.comp || "")}</span>${m.round ? `<span>${esc(m.round)}</span>` : ""}</span>`;
