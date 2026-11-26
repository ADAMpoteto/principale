/* ホーム */

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
