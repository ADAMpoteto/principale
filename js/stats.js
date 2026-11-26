/* 集計（選手・チーム・ランキング項目） */

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
