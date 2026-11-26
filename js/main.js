/* ルーターと起動 */

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
  view.innerHTML = (V[page] || vHome)(page === "player" || page === "staff" ? fromSlug(arg) : arg);
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
