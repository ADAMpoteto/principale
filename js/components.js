/* 画面のパーツ（見出し・試合の行・順位表・試合カード） */

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
  return `<div class="rk-card"><a class="rk-top" href="#/player/${pslug(f.p.name)}"><div class="who"><h3>${esc(label || M.k)}</h3><b>${esc(f.p.name)}</b><small>${esc(f.p.pos || "")}</small></div>
      ${face(f.p.name)}<div class="big${v(f.v).length >= 5 ? " l5" : v(f.v).length >= 4 ? " l4" : ""}">${v(f.v)}</div></a>
    ${R.slice(1).map((x, i) => `<a class="rk-row${i >= 4 ? " more" : i >= 2 ? " m-more" : ""}" href="#/player/${pslug(x.p.name)}"><span class="n">${i + 2}</span><span class="nm">${esc(x.p.name)}</span><span class="val">${v(x.v)}</span></a>`).join("")}
    ${R.length > 3 ? `<button type="button" class="all${R.length > 5 ? "" : " m-only"}" onclick="const c=this.parentNode;c.classList.toggle('open');this.textContent=c.classList.contains('open')?'閉じる':'ランキングを見る（${R.length}人）'">ランキングを見る（${R.length}人）</button>` : ""}</div>`;
}
const seasonLabel = s => s || "";

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
