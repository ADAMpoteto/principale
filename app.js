/* =====================================================================
   Principale ― FC27 監督キャリアの記録サイト
   データはGoogleスプレッドシートから読み込みます。

   ■ つなぎ方（どちらか1つ）
     A. スプシを「共有 → リンクを知っている全員（閲覧者）」にする
        → SHEET_ID にスプシのID（URLの /d/ と /edit の間）を入れるだけ（入れてあります）
     B. スプシを「ファイル → 共有 → ウェブに公開（ドキュメント全体）」する
        → 公開したときのURLを PUB_URL に貼る（こちらのほうが読み込みが安定します）

   ■ 画像（GitHubの images フォルダに、名前と同じファイル名で置くだけ）
     選手の写真   : images/player/上田 綺世.png   （.webp / .jpg でもOK。スペースなしでもOK）
     クラブのロゴ : images/logo/鹿島.png           （試合シートの「相手」と同じ名前）
     自分のクラブ : images/logo/Principale.png
     画像がない選手・クラブは、頭文字で表示します。
   ===================================================================== */
const SHEET_ID = "1ZRRBDpNq5W9pzgagLqxMQ8shDBI_vpNMLT8R_Wiezs8";
const PUB_URL  = "";   // 例："https://docs.google.com/spreadsheets/d/e/2PACX-…/pubhtml"

const SHEETS = {   // [シート名, gid]
  match:  ["試合",         0],
  tstats: ["チームスタッツ", 107],
  lineup: ["出場選手",     108],
  events: ["試合経過",     109],
  player: ["選手",         102],
  trans:  ["移籍",         103],
  season: ["シーズン",     104],
  table:  ["順位表",       105],
  conf:   ["設定",         106]
};
const DEFAULT_CLUB = "Principale";
const IMG_EXT = ["png", "webp", "jpg"];

/* ---------- 小物 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const half = s => String(s==null?"":s).replace(/[０-９．－，＋％]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
const F = (o,k) => (o && o[k]!=null) ? String(o[k]).trim() : "";
function num(s){ const t=half(s).replace(/[,\s人万円€%]/g,""); if(t==="") return null; const n=Number(t); return isFinite(n)?n:null; }
function pct(s){ const t=half(s).trim(); const n=num(t); if(n==null) return null; return (!/%/.test(t) && n>0 && n<=1 && /\./.test(t)) ? Math.round(n*1000)/10 : n; }
function pDate(s){ const m=half(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
const WD=["日","月","火","水","木","金","土"], WDE=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const fmtD = d => d ? `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}` : "";
const fmtDW = d => d ? `${fmtD(d)}（${WD[d.getDay()]}）` : "";
const fmtMD = d => d ? `${d.getMonth()+1}/${d.getDate()}` : "";
const dKey = d => d ? fmtD(d) : "";
const nf = n => Number(n||0).toLocaleString("ja-JP");
const nameKey = s => String(s||"").replace(/[\s　・.]/g,"").toLowerCase();
const surname = s => String(s||"").trim().split(/[\s　]+/)[0];
const empty = msg => `<div class="empty">${esc(msg)}</div>`;
const same = (a,b) => nameKey(a)===nameKey(b);
const sum = (L,f) => L.reduce((a,x)=>a+(f(x)||0),0);

function cleanRows(rows){
  return (rows||[]).map(o=>{ const n={}; Object.keys(o).forEach(k=>{ n[String(k).replace(/^﻿/,"").replace(/\s+/g,"").trim()]=o[k]; }); return n; })
    .filter(o=>Object.values(o).some(v=>String(v==null?"":v).trim()!==""));
}
function sheetUrl(key){
  const [name, gid] = SHEETS[key];
  const m = String(PUB_URL).match(/\/d\/e\/([^/]+)\/pub/);
  if(m) return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?gid=${gid}&single=true&output=csv`;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
}
function fetchCSV(url){
  return new Promise((resolve,reject)=>{
    if(typeof Papa==="undefined"){ reject(new Error("PapaParse 未読み込み")); return; }
    Papa.parse(url, { download:true, header:true, skipEmptyLines:"greedy", complete:r=>resolve(cleanRows(r.data)), error:reject });
  });
}

/* ---------- 画像（名前→ファイル。見つからなければ次の候補、最後は頭文字） ---------- */
const IMG_OK = {};
function imgCands(dir, names){
  const out=[]; names.filter(Boolean).forEach(n=>{
    [...new Set([String(n).trim(), String(n).replace(/[\s　]/g,"")])].forEach(b=>IMG_EXT.forEach(e=>out.push(`images/${dir}/${b}.${e}`)));
  });
  return [...new Set(out)];
}
function initials(name){
  const s=String(name||"").trim(); if(!s) return "?";
  if(/^[\x00-\x7F\s]+$/.test(s)){ const w=s.split(/\s+/).filter(Boolean); return (w.length>1? w[0][0]+w[1][0] : s.slice(0,2)).toUpperCase(); }
  return surname(s).slice(0,2);
}
function imgTag(cands, alt, cls, key){
  const list=IMG_OK[key] ? [IMG_OK[key]] : cands;
  return `<img class="${cls}" src="${esc(encodeURI(list[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async"
    data-k="${esc(key)}" data-c="${esc(list.slice(1).join("|"))}" data-i="${esc(initials(alt))}" onload="imgOk(this)" onerror="imgNext(this)">`;
}
window.imgOk = el => { const k=el.dataset.k; if(k && !IMG_OK[k]) IMG_OK[k]=decodeURI(el.getAttribute("src")); };
window.imgNext = el => {
  const rest=(el.dataset.c||"").split("|").filter(Boolean);
  if(rest.length){ el.dataset.c=rest.slice(1).join("|"); el.src=encodeURI(rest[0]); return; }
  const d=document.createElement("div"); d.className=el.className+" ph"; d.textContent=el.dataset.i||"?"; d.setAttribute("aria-label", el.alt||"");
  el.replaceWith(d);
};
function face(name, cls){
  const n=fullName(name), p=D.players.find(x=>same(x.name,n)), ph=p&&p.photo ? String(p.photo).trim() : "";
  /* 写真の欄にファイル名（拡張子つきでも、なしでも）を書けばそれを使う */
  const c = ph ? (/\.(png|webp|jpe?g|gif)$/i.test(ph) ? [`images/player/${ph}`] : imgCands("player",[ph])).concat(imgCands("player",[n])) : imgCands("player",[n]);
  return imgTag(c, n, "face "+(cls||""), "p:"+nameKey(n));
}
const oppFace = (name, cls) => imgTag([], name, "face "+(cls||""), "o:"+nameKey(name));
function logo(club, cls){
  const me=isMe(club);
  const names= me ? [clubName(), DEFAULT_CLUB] : [club];
  return imgTag(imgCands("logo",names), me?clubName():club, "logo "+(cls||""), "l:"+(me?"__me":nameKey(club)));
}

/* =====================================================================
   データ
   ===================================================================== */
const D = { matches:[], played:[], stats:[], players:[], trans:[], seasons:[], table:[], lineups:[], conf:{}, seasonList:[], news:[], loaded:false, err:"" };
const ST = { pSeason:null, luGrp:"攻撃", season:null, stSeason:"", trSeason:"", comp:"すべて", newsCat:"すべて", rk:"g", tblSeason:null, tblComp:null, mtab:"sum", luSide:"me" };

const clubName = () => D.conf["クラブ名"] || DEFAULT_CLUB;
const unit = () => D.conf["通貨の単位"] || "";
function isMe(club){
  const k=nameKey(club); if(!k) return false;
  return k===nameKey(clubName()) || k===nameKey(D.conf["略称"]) || k===nameKey(DEFAULT_CLUB) || /自分/.test(club);
}
const NAME_CACHE = {};
function fullName(n){
  const s=String(n||"").trim(); if(!s) return s;
  if(NAME_CACHE[s]) return NAME_CACHE[s];
  const k=nameKey(s);
  const pool=[...D.players.map(p=>p.name), ...D.stats.map(r=>r.name), ...D.lineups.filter(l=>l.side==="me").map(l=>l.rawName)];
  let hit=pool.find(p=>nameKey(p)===k);
  if(!hit){ const c=[...new Set(pool.filter(p=>nameKey(surname(p))===k).map(p=>String(p).trim()))]; if(c.length===1) hit=c[0]; }
  return NAME_CACHE[s]=hit||s;
}
function parseNames(s){
  return String(s||"").split(/[、,，\n／\/]/).map(t=>t.trim()).filter(Boolean).map(t=>{
    const m=half(t).match(/^(.*?)[\s　]*[（(×xX]?\s*(\d+)\s*[)）点]?$/);
    if(m && m[1].trim()) return { name:fullName(m[1].trim()), n:+m[2] };
    return { name:fullName(t), n:1 };
  });
}
function parsePK(s){
  const t=half(s).trim(); if(!t) return null;
  let m=t.match(/^(\d{1,2})\s*[-ー:：]\s*(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^\d{4}\D(\d{1,2})\D(\d{1,2})/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^(\d{1,2})\/(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  return null;
}
/* フォーメーション：「4-3-3」。日付に変わってしまったもの（2026/04/03）にも対応 */
function parseForm(s){
  const t=half(s).trim(); if(!t) return "";
  if(/^\d(\s*[-ー]\s*\d){1,4}$/.test(t)) return t.replace(/\s*[-ー]\s*/g,"-");
  const m=t.match(/^\d{4}\D(\d{1,2})\D(\d{1,2})$/); if(m) return `${+m[1]}-${+m[2]}`;
  return t;
}
const sideOf = s => /相手|opp|away/i.test(s) ? "opp" : "me";
const minN = s => { const m=half(s).match(/(\d+)(?:\s*\+\s*(\d+))?/); return m ? +m[1] + (m[2]? +m[2]/100 : 0) : 999; };
const POS_DEPTH = {GK:0,CB:1,LB:1.1,RB:1.1,SW:.9,LWB:1.6,RWB:1.6,CDM:2,DM:2,CM:2.5,LM:2.6,RM:2.6,CAM:3,AM:3,LW:3.4,RW:3.4,LF:3.6,RF:3.6,CF:3.7,ST:4,FW:4,MF:2.5,DF:1};
const POS_LAT = p => /^(LB|LWB|LM|LW|LF)$/.test(p)?0 : /^(RB|RWB|RM|RW|RF)$/.test(p)?2 : 1;
const posGroup = p => { const x=String(p||"").toUpperCase().trim();
  if(/^GK/.test(x)) return "GK"; if(/^(CB|LB|RB|LWB|RWB|SW|DF)/.test(x)) return "DF";
  if(/^(CDM|CM|CAM|LM|RM|DM|AM|MF)/.test(x)) return "MF"; if(/^(LW|RW|CF|ST|LF|RF|FW)/.test(x)) return "FW"; return "OT"; };
const GROUPS = [["GK","GOALKEEPER","ゴールキーパー"],["DF","DEFENDER","ディフェンダー"],["MF","MIDFIELDER","ミッドフィルダー"],["FW","FORWARD","フォワード"],["OT","OTHER","その他"]];

/* ---------- Jリーグ公式＋FotMobの項目（スプシの列名＝ここの名前） ---------- */
const P_NUM = ["出場時間", "得点", "アシスト", "シュート", "枠内シュート", "枠外シュート", "ブロックされたシュート", "ポスト・バー", "ゴール期待値", "枠内ゴール期待値", "期待アシスト", "チャンスクリエイト", "ビッグチャンス創出", "ビッグチャンス逸機", "タッチ", "PA内タッチ", "獲得PK", "パス", "パス成功", "敵陣パス", "敵陣パス成功", "ファイナルサードへのパス", "ロングパス", "ロングパス成功", "スルーパス", "スルーパス成功", "クロス", "クロス成功", "ドリブル", "ドリブル成功", "ボールロスト", "タックル", "タックル成功", "インターセプト", "ブロック", "クリア", "ヘディングクリア", "空中戦", "空中戦勝利", "デュエル勝利", "デュエル敗北", "こぼれ球奪取", "抜かれた回数", "シュートにつながるミス", "失点につながるミス", "ファウル", "被ファウル", "オフサイド", "警告", "退場", "フリーキック", "コーナーキック", "プレー数", "被シュート", "被枠内シュート", "被枠内ゴール期待値", "失点", "セーブ", "ダイビングセーブ", "PA内被枠内シュート", "PA内セーブ", "PA内キャッチ", "PA内パンチング", "PA外被枠内シュート", "PA外セーブ", "PA外キャッチ", "PA外パンチング", "被クロス", "クロスキャッチ", "クロスパンチング", "飛び出し", "ハイボール処理", "スロー", "走行距離", "ランニング距離", "スプリント距離", "トップスピード", "スプリント", "Atスプリント", "Mtスプリント", "Dtスプリント", "ポゼッション時走行距離", "ポゼッション時スプリント", "被ポゼッション時走行距離", "被ポゼッション時スプリント"];
const T_NUM = ["ボール支配率", "シュート", "枠内シュート", "枠外シュート", "ブロックされたシュート", "ポスト・バー", "PA内シュート", "PA外シュート", "ビッグチャンス", "ビッグチャンス逸機", "ゴール期待値", "流れからのゴール期待値", "セットプレーからのゴール期待値", "PKを除くゴール期待値", "枠内ゴール期待値", "パス", "パス成功", "敵陣パス", "敵陣パス成功", "ロングパス", "ロングパス成功", "ドリブル", "ドリブル成功", "スルーパス", "スルーパス成功", "クロス", "クロス成功", "PA内タッチ", "スローイン", "チャンスクリエイト", "クリア", "タックル", "タックル成功", "ブロック", "インターセプト", "セーブ", "空中戦", "空中戦勝利", "デュエル勝利", "1vs1勝利", "こぼれ球奪取", "シュートにつながるミス", "失点につながるミス", "ファウル", "警告", "退場", "コーナーキック", "直接FK", "間接FK", "オフサイド", "PK", "ゴールキック", "走行距離", "スプリント", "Atスプリント", "Mtスプリント", "Dtスプリント", "ポゼッション時走行距離", "ポゼッション時スプリント", "被ポゼッション時走行距離", "被ポゼッション時スプリント"];
const MAX_KEYS = {"トップスピード":1};            /* 合計ではなく最大値を取る項目 */
const PCT_KEYS = {"ボール支配率":1};               /* %の項目（0.56 のような入力も56に直す） */
const rate = (a,b) => (a!=null && b) ? a/b*100 : null;

async function loadAll(){
  const keys=Object.keys(SHEETS);
  const res=await Promise.allSettled(keys.map(k=>fetchCSV(sheetUrl(k))));
  const got={}; let fails=0;
  keys.forEach((k,i)=>{ if(res[i].status==="fulfilled") got[k]=res[i].value; else { got[k]=[]; fails++; console.error(SHEETS[k][0], res[i].reason); } });
  if(fails===keys.length) D.err="スプレッドシートを読み込めませんでした。スプシを「リンクを知っている全員（閲覧者）」に共有するか、「ウェブに公開」して app.js の PUB_URL にURLを入れてください。";

  got.conf.forEach(o=>{ const k=F(o,"項目"), v=F(o,"値"); if(k) D.conf[k]=v; });
  D.players=got.player.map(o=>({ name:F(o,"名前"), pos:F(o,"ポジション").toUpperCase(), nat:F(o,"国籍"), birth:pDate(F(o,"生年月日")), birthS:F(o,"生年月日"),
    foot:F(o,"利き足"), height:num(F(o,"身長")), memo:F(o,"メモ"), photo:F(o,"写真") })).filter(p=>p.name);
  /* 出場選手（名前合わせに使うので先に） */
  D.lineups=got.lineup.map((o,i)=>{ const side=sideOf(F(o,"チーム")); const raw=F(o,"名前");
    const s={}; P_NUM.forEach(h=>{ const v=num(F(o,h)); if(v!=null) s[h]=v; });
    return { i, key:dKey(pDate(F(o,"日付"))), side, role:F(o,"出場")||"先発", no:num(F(o,"背番号")), rawName:raw, pos:F(o,"ポジション").toUpperCase(), s,
      min:s["出場時間"]??null, g:s["得点"]||0, a:s["アシスト"]||0, yc:s["警告"]||0, rc:s["退場"]||0 }; }).filter(l=>l.rawName && l.key);
  D.lineups.forEach(l=>l.name = l.side==="me" ? fullName(l.rawName) : l.rawName);

  /* 試合（得点・失点が空欄なら「これからの試合」） */
  D.matches=got.match.map((o,i)=>{
    const gf=num(F(o,"得点")), ga=num(F(o,"失点")), opp=F(o,"相手");
    if(!opp) return null;
    const played = gf!=null && ga!=null;
    const pk=parsePK(F(o,"PK"));
    const res = !played ? "U" : gf>ga?"W" : gf<ga?"L" : pk ? (pk.a>pk.b?"W":"L") : "D";
    let ha=F(o,"H/A").toUpperCase(); ha = /^A/.test(ha)?"A" : /^N/.test(ha)?"N" : "H";
    const date=pDate(F(o,"日付"));
    return { i, season:F(o,"シーズン"), date, key:dKey(date), comp:F(o,"大会")||"試合", round:F(o,"節・回戦"), ha, opp, gf, ga, pk, res, played,
      draw: played && gf===ga, scorers:parseNames(F(o,"得点者")), assists:parseNames(F(o,"アシスト")), mom:fullName(F(o,"MOM")),
      att:num(F(o,"観客数")), memo:F(o,"メモ"), ts:{}, form:{}, lu:{me:[],opp:[]}, ev:[] };
  }).filter(Boolean);
  D.matches.sort((a,b)=>(a.date&&b.date? a.date-b.date : 0) || a.i-b.i);
  D.matches.forEach((m,k)=>m.id=k+1);
  const byKey={}; D.matches.forEach(m=>{ if(m.key && !byKey[m.key]) byKey[m.key]=m; });

  /* チームスタッツ */
  got.tstats.forEach(o=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return; const side=sideOf(F(o,"チーム"));
    const t={}; T_NUM.forEach(h=>{ const v= PCT_KEYS[h] ? pct(F(o,h)) : num(F(o,h)); if(v!=null) t[h]=v; });
    m.ts[side]=t; m.form[side]=parseForm(F(o,"フォーメーション")); });
  /* 出場選手を試合につなぐ */
  D.lineups.forEach(l=>{ const m=byKey[l.key]; if(m){ l.m=m; m.lu[l.side].push(l); } });
  /* 試合経過 */
  got.events.forEach((o,i)=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return; const side=sideOf(F(o,"チーム"));
    const nm = s => side==="me" ? fullName(s) : s;
    m.ev.push({ i, min:half(F(o,"分")), mn:minN(F(o,"分")), side, kind:F(o,"種類")||"その他", player:nm(F(o,"選手")), rel:nm(F(o,"関連する選手")),
      body:F(o,"部位"), note:F(o,"補足") }); });
  D.matches.forEach(m=>{
    m.ev.sort((a,b)=>a.mn-b.mn || a.i-b.i);
    if(!m.played) return;
    /* 得点者・アシストが空欄なら、出場選手 → 試合経過 の順で補う */
    if(!m.scorers.length){
      const L=m.lu.me.filter(l=>l.g); if(L.length) m.scorers=L.map(l=>({name:l.name,n:l.g}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&isGoal(e)&&e.player).forEach(e=>c[e.player]=(c[e.player]||0)+1); m.scorers=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
    if(!m.assists.length){
      const L=m.lu.me.filter(l=>l.a); if(L.length) m.assists=L.map(l=>({name:l.name,n:l.a}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&isGoal(e)&&e.rel).forEach(e=>c[e.rel]=(c[e.rel]||0)+1); m.assists=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
  });
  D.played=D.matches.filter(m=>m.played);

  D.trans=got.trans.map((o,i)=>({ i, season:F(o,"シーズン"), date:pDate(F(o,"日付")), kind:F(o,"区分")||"加入", name:fullName(F(o,"名前")),
    club:F(o,"相手クラブ"), fee:num(F(o,"移籍金")), memo:F(o,"メモ") })).filter(t=>t.name);
  D.seasons=got.season.map(o=>({ season:F(o,"シーズン"), league:F(o,"リーグ"), rank:half(F(o,"リーグ順位")).replace(/位$/,""), cup:F(o,"国内カップ"),
    lcup:F(o,"リーグカップ"), intl:F(o,"国際大会"), cap:fullName(F(o,"主将")), comment:F(o,"一言") })).filter(s=>s.season);
  D.table=got.table.map(o=>({ season:F(o,"シーズン"), comp:F(o,"大会"), rank:num(F(o,"順位")), club:F(o,"クラブ"), p:num(F(o,"試合")),
    w:num(F(o,"勝")), d:num(F(o,"分")), l:num(F(o,"負")), gf:num(F(o,"得点")), ga:num(F(o,"失点")), pts:num(F(o,"勝点")) })).filter(r=>r.club);

  const ss=new Set([...D.matches,...D.trans,...D.seasons,...D.table].map(x=>x.season).filter(Boolean));
  if(D.conf["最初のシーズン"] && !ss.size) ss.add(D.conf["最初のシーズン"]);
  D.seasonList=[...ss].sort().reverse();
  const lastPlayed=D.played[D.played.length-1];
  ST.season = (lastPlayed && lastPlayed.season) || D.seasonList[0] || null;
  ST.stSeason = ST.trSeason = ST.season || "";
  buildNews();
  D.loaded=true;
  ["hd-name","ft-club","ft-name"].forEach(id=>$(id).textContent=clubName());
}
const isGoal = e => /^(ゴール|PKゴール|FKゴール)$/.test(e.kind);

/* ---------- 集計 ---------- */
const ofSeason = s => D.played.filter(m=>!s || m.season===s);
function record(L){
  const r={n:L.length,w:0,d:0,l:0,gf:0,ga:0,cs:0};
  L.forEach(m=>{ if(m.draw) r.d++; else if(m.res==="W") r.w++; else r.l++; r.gf+=m.gf; r.ga+=m.ga; if(m.ga===0) r.cs++; });
  return r;
}
const seasonInfo = s => D.seasons.find(x=>x.season===s) || null;
function myRank(s){
  const S=seasonInfo(s); if(S && S.rank) return S.rank;
  const t=D.table.filter(r=>r.season===s && isMe(r.club));
  return t.length ? String(t[0].rank||"") : "";
}
function leagueName(s){
  const S=seasonInfo(s); if(S && S.league) return S.league;
  const L=ofSeason(s).filter(m=>/リーグ|League|J1|J2|J3/i.test(m.comp));
  return L.length ? L[0].comp : "";
}
/* チームの値：チームスタッツシート → なければ出場選手の合計 */
function teamVal(m, side, h){
  const t=m.ts[side]||{};
  if(t[h]!=null) return t[h];
  const L=m.lu[side].filter(l=>l.s[h]!=null);
  if(!L.length || h==="ボール支配率") return null;
  return MAX_KEYS[h] ? Math.max(...L.map(l=>l.s[h])) : L.reduce((a,l)=>a+l.s[h],0);
}
function fromMatches(s){
  const M={}; const add=(n,k,v)=>{ if(!n) return; (M[n]=M[n]||{name:n,得点:0,アシスト:0,mom:0})[k]+=v; };
  ofSeason(s).forEach(m=>{ m.scorers.forEach(x=>add(x.name,"得点",x.n)); m.assists.forEach(x=>add(x.name,"アシスト",x.n)); if(m.mom) add(m.mom,"mom",1); });
  return Object.values(M).map(o=>({...o, g:o.得点, a:o.アシスト}));
}
/* 出場選手シートから、選手のシーズン成績（合計）を作る。s=""なら通算 */
function luAgg(s){
  const M={};
  D.lineups.filter(l=>l.side==="me" && l.m && l.m.played && (!s || l.m.season===s) && (l.role!=="ベンチ" || l.min)).forEach(l=>{
    const k=nameKey(l.name);
    const o=M[k]=M[k]||{name:l.name,season:s,apps:0,starts:0,cs:0,mom:0,pos:"",no:null,_n:{}};
    o.apps++; if(l.role==="先発") o.starts++; if(l.pos) o.pos=l.pos; if(l.no!=null) o.no=l.no;
    Object.keys(l.s).forEach(h=>{ const v=l.s[h]; o[h]= MAX_KEYS[h] ? Math.max(o[h]??0, v) : (o[h]||0)+v; o._n[h]=(o._n[h]||0)+1; });
    if(l.pos==="GK" && l.role==="先発" && l.m.ga===0) o.cs++;
    if(same(l.m.mom,l.name)) o.mom++;
  });
  /* ゴールの内訳（試合経過の種類・部位から） */
  D.played.filter(m=>!s || m.season===s).forEach(m=>m.ev.filter(e=>e.side==="me"&&isGoal(e)&&e.player).forEach(e=>{
    const o=M[nameKey(e.player)]; if(!o) return;
    const add=k=>o[k]=(o[k]||0)+1;
    if(e.kind==="PKゴール") add("PK得点"); if(e.kind==="FKゴール") add("FK得点");
    ({"左足":"左足得点","右足":"右足得点","ヘディング":"ヘディング得点","その他":"その他部位得点"})[e.body] && add({"左足":"左足得点","右足":"右足得点","ヘディング":"ヘディング得点","その他":"その他部位得点"}[e.body]);
  }));
  return Object.values(M).map(o=>({...o, g:o["得点"]||0, a:o["アシスト"]||0, yc:o["警告"]||0, rc:o["退場"]||0, min:o["出場時間"]||0}));
}
const seasonRows = s => luAgg(s);
function statRowsFor(s){
  const L=luAgg(s);
  if(L.length) return L;
  return fromMatches(s);
}
function seasonsOfPlayer(name){
  return D.seasonList.slice().sort().map(s=>seasonRows(s).find(r=>same(r.name,name))).filter(Boolean);
}
const latestStat = name => { const L=seasonsOfPlayer(name); return L[L.length-1]||null; };
const profile = name => D.players.find(p=>same(p.name,name)) || null;
function ageAt(birth, season){
  if(!birth) return null; const y=parseInt(season,10); const ref=y? new Date(y,7,1) : new Date();
  let a=ref.getFullYear()-birth.getFullYear(); if(ref < new Date(ref.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a;
}
const IN_K=["加入","レンタル加入","昇格","レンタル復帰"], OUT_K=["退団","レンタル移籍"];
const trDir = k => IN_K.includes(k)?"in" : OUT_K.includes(k)?"out" : "etc";
const money = v => v==null ? "" : `${nf(v)}${esc(unit())}`;
function topOf(s, k){
  let rows=statRowsFor(s).filter(r=>r[k]); if(!rows.length) rows=fromMatches(s).filter(r=>r[k]);
  rows.sort((a,b)=>b[k]-a[k]); return rows[0]||null;
}

/* ---------- 選手の指標（Jリーグ公式の選手スタッツの並び＋FotMobの項目） ----------
   f: 合計から値を出す / u: 単位 / d: 小数の桁 / avg: 1試合平均も出す / min: ランキングに載る条件 */
const per = (T,h) => T.apps ? (T[h]||0)/T.apps : null;
const PM = [
  ["出場", [
    ["出場試合数", T=>T.apps, "試合"], ["先発", T=>T.starts, "試合"], ["出場時間", T=>T["出場時間"], "分"], ["MOM", T=>T.mom, "回"] ]],
  ["攻撃", [
    ["得点", T=>T["得点"], "点", 0, 1], ["シュート", T=>T["シュート"], "本", 0, 1], ["枠内シュート", T=>T["枠内シュート"], "本"], ["枠外シュート", T=>T["枠外シュート"], "本"], ["ブロックされたシュート", T=>T["ブロックされたシュート"], "本"], ["ポスト・バー", T=>T["ポスト・バー"], "回"],
    ["シュート決定率", T=>rate(T["得点"]||0,T["シュート"]), "%", 1, 0, T=>T["シュート"]],
    ["ゴール期待値", T=>T["ゴール期待値"], "", 2, 1], ["枠内ゴール期待値", T=>T["枠内ゴール期待値"], "", 2], ["得点とゴール期待値の差", T=>T["ゴール期待値"]!=null?(T["得点"]||0)-T["ゴール期待値"]:null, "", 2],
    ["ビッグチャンス逸機", T=>T["ビッグチャンス逸機"], "回"], ["タッチ", T=>T["タッチ"], "回", 0, 1], ["PA内タッチ", T=>T["PA内タッチ"], "回", 0, 1], ["獲得PK", T=>T["獲得PK"], "回"],
    ["左足得点", T=>T["左足得点"], "点"], ["右足得点", T=>T["右足得点"], "点"], ["ヘディング得点", T=>T["ヘディング得点"], "点"], ["その他部位得点", T=>T["その他部位得点"], "点"],
    ["FK得点", T=>T["FK得点"], "点"], ["PK得点", T=>T["PK得点"], "点"],
    ["アシスト", T=>T["アシスト"], "", 0, 1], ["期待アシスト", T=>T["期待アシスト"], "", 2, 1],
    ["ゴール期待値＋期待アシスト", T=>(T["ゴール期待値"]!=null||T["期待アシスト"]!=null)?(T["ゴール期待値"]||0)+(T["期待アシスト"]||0):null, "", 2, 1],
    ["得点＋アシスト", T=>(T["得点"]||0)+(T["アシスト"]||0), "", 0, 1],
    ["チャンスクリエイト", T=>T["チャンスクリエイト"], "回", 0, 1], ["ビッグチャンス創出", T=>T["ビッグチャンス創出"], "回"] ]],
  ["パス・ドリブル", [
    ["パス", T=>T["パス"], "本", 0, 1], ["パス成功率", T=>rate(T["パス成功"],T["パス"]), "%", 1, 0, T=>T["パス"]],
    ["敵陣パス", T=>T["敵陣パス"], "本", 0, 1], ["敵陣パス成功率", T=>rate(T["敵陣パス成功"],T["敵陣パス"]), "%", 1, 0, T=>T["敵陣パス"]],
    ["自陣パス", T=>T["敵陣パス"]!=null&&T["パス"]!=null?T["パス"]-T["敵陣パス"]:null, "本", 0, 1],
    ["自陣パス成功率", T=>(T["敵陣パス"]!=null&&T["パス成功"]!=null&&T["敵陣パス成功"]!=null)?rate(T["パス成功"]-T["敵陣パス成功"],T["パス"]-T["敵陣パス"]):null, "%", 1, 0, T=>T["パス"]!=null&&T["敵陣パス"]!=null?T["パス"]-T["敵陣パス"]:0],
    ["ファイナルサードへのパス", T=>T["ファイナルサードへのパス"], "本", 0, 1], ["ロングパス", T=>T["ロングパス"], "本", 0, 1], ["ロングパス成功率", T=>rate(T["ロングパス成功"],T["ロングパス"]), "%", 1, 0, T=>T["ロングパス"]],
    ["スルーパス", T=>T["スルーパス"], "本"], ["スルーパス成功率", T=>rate(T["スルーパス成功"],T["スルーパス"]), "%", 1, 0, T=>T["スルーパス"]],
    ["クロス", T=>T["クロス"], "本", 0, 1], ["クロス成功率", T=>rate(T["クロス成功"],T["クロス"]), "%", 1, 0, T=>T["クロス"]],
    ["ドリブル", T=>T["ドリブル"], "回", 0, 1], ["ドリブル成功率", T=>rate(T["ドリブル成功"],T["ドリブル"]), "%", 1, 0, T=>T["ドリブル"]],
    ["ボールロスト", T=>T["ボールロスト"], "回", 0, 1], ["プレー数", T=>T["プレー数"], "回", 0, 1] ]],
  ["守備", [
    ["タックル", T=>T["タックル"], "回", 0, 1], ["タックル成功率", T=>rate(T["タックル成功"],T["タックル"]), "%", 1, 0, T=>T["タックル"]],
    ["インターセプト", T=>T["インターセプト"], "回", 0, 1], ["ブロック", T=>T["ブロック"], "回"], ["クリア", T=>T["クリア"], "回"], ["ヘディングクリア", T=>T["ヘディングクリア"], "回"],
    ["空中戦勝利", T=>T["空中戦勝利"], "回"], ["空中戦勝率", T=>rate(T["空中戦勝利"],T["空中戦"]), "%", 1, 0, T=>T["空中戦"]],
    ["デュエル勝利", T=>T["デュエル勝利"], "回", 0, 1], ["デュエル勝率", T=>T["デュエル敗北"]!=null?rate(T["デュエル勝利"]||0,(T["デュエル勝利"]||0)+T["デュエル敗北"]):null, "%", 1, 0, T=>(T["デュエル勝利"]||0)+(T["デュエル敗北"]||0)],
    ["こぼれ球奪取", T=>T["こぼれ球奪取"], "回", 0, 1], ["抜かれた回数", T=>T["抜かれた回数"], "回"],
    ["シュートにつながるミス", T=>T["シュートにつながるミス"], "回"], ["失点につながるミス", T=>T["失点につながるミス"], "回"] ]],
  ["規律・セットプレー", [
    ["ファウル", T=>T["ファウル"], "回"], ["被ファウル", T=>T["被ファウル"], "回"], ["警告", T=>T["警告"], "枚"], ["退場", T=>T["退場"], "回"], ["オフサイド", T=>T["オフサイド"], "回"],
    ["フリーキック", T=>T["フリーキック"], "本"], ["コーナーキック", T=>T["コーナーキック"], "本"] ]],
  ["GK", [
    ["被シュート", T=>T["被シュート"], "本"], ["被枠内シュート", T=>T["被枠内シュート"], "本"], ["失点", T=>T["失点"], "点"],
    ["セーブ", T=>T["セーブ"], "回", 0, 1], ["セーブ率", T=>rate(T["セーブ"],T["被枠内シュート"]), "%", 1, 0, T=>T["被枠内シュート"]],
    ["被枠内ゴール期待値", T=>T["被枠内ゴール期待値"], "", 2], ["防いだ失点", T=>T["被枠内ゴール期待値"]!=null?T["被枠内ゴール期待値"]-(T["失点"]||0):null, "", 2],
    ["ダイビングセーブ", T=>T["ダイビングセーブ"], "回"],
    ["PA内シュートセーブ率", T=>rate(T["PA内セーブ"],T["PA内被枠内シュート"]), "%", 1, 0, T=>T["PA内被枠内シュート"]],
    ["PA外シュートセーブ率", T=>rate(T["PA外セーブ"],T["PA外被枠内シュート"]), "%", 1, 0, T=>T["PA外被枠内シュート"]],
    ["PA内シュートキャッチ率", T=>rate(T["PA内キャッチ"],T["PA内被枠内シュート"]), "%", 1, 0, T=>T["PA内被枠内シュート"]],
    ["PA外シュートキャッチ率", T=>rate(T["PA外キャッチ"],T["PA外被枠内シュート"]), "%", 1, 0, T=>T["PA外被枠内シュート"]],
    ["PA内シュートパンチング率", T=>rate(T["PA内パンチング"],T["PA内被枠内シュート"]), "%", 1, 0, T=>T["PA内被枠内シュート"]],
    ["PA外シュートパンチング率", T=>rate(T["PA外パンチング"],T["PA外被枠内シュート"]), "%", 1, 0, T=>T["PA外被枠内シュート"]],
    ["クロスキャッチ率", T=>rate(T["クロスキャッチ"],T["被クロス"]), "%", 1, 0, T=>T["被クロス"]],
    ["クロスパンチング率", T=>rate(T["クロスパンチング"],T["被クロス"]), "%", 1, 0, T=>T["被クロス"]],
    ["飛び出し", T=>T["飛び出し"], "回"], ["ハイボール処理", T=>T["ハイボール処理"], "回"], ["スロー", T=>T["スロー"], "本", 0, 1],
    ["クリーンシート", T=>T.cs, "試合"] ]],
  ["フィジカル", [
    ["走行距離", T=>T["走行距離"], "km", 1, 1], ["ランニング距離", T=>T["ランニング距離"], "km", 2, 1], ["スプリント距離", T=>T["スプリント距離"], "km", 2, 1], ["トップスピード", T=>T["トップスピード"], "km/h", 1], ["スプリント", T=>T["スプリント"], "回", 0, 1],
    ["Atスプリント", T=>T["Atスプリント"], "回", 0, 1], ["Mtスプリント", T=>T["Mtスプリント"], "回", 0, 1], ["Dtスプリント", T=>T["Dtスプリント"], "回", 0, 1],
    ["ポゼッション時走行距離", T=>T["ポゼッション時走行距離"], "km", 1, 1], ["ポゼッション時スプリント", T=>T["ポゼッション時スプリント"], "回", 0, 1],
    ["被ポゼッション時走行距離", T=>T["被ポゼッション時走行距離"], "km", 1, 1], ["被ポゼッション時スプリント", T=>T["被ポゼッション時スプリント"], "回", 0, 1] ]]
];
const PM_ALL = PM.flatMap(([g,L])=>L.map(x=>({g, k:x[0], f:x[1], u:x[2]||"", d:x[3]||0, avg:!!x[4], base:x[5]||null})));
const fmtV = (v,d) => v==null||!isFinite(v) ? "-" : d ? (+v).toFixed(d) : nf(Math.round(v));
/* 1試合平均（走行距離などは記録がある試合数で割る） */
function avgOf(T, M){ const h=M.k; const n=(T._n&&T._n[h])||T.apps; const v=M.f(T); return (v!=null && n) ? v/n : null; }

/* =====================================================================
   ニュース（試合・移籍・シーズンの行から自動で作る）
   ===================================================================== */
const KIND_EN = { "加入":"NEW COMER", "レンタル加入":"NEW COMER", "昇格":"PROMOTION", "レンタル復帰":"WELCOME BACK", "退団":"FAREWELL", "レンタル移籍":"ON LOAN", "契約延長":"RENEWAL" };
const resWord = m => m.draw ? (m.pk ? (m.res==="W"?"PK戦の末に勝利":"PK戦の末に敗退") : "引き分け") : m.res==="W" ? "勝利" : "敗戦";
const resEN = m => !m.played ? "NEXT" : m.draw && m.pk ? (m.res==="W"?"WIN (PK)":"LOSE (PK)") : m.draw?"DRAW" : m.res==="W"?"WIN":"LOSE";
const resCls = m => !m.played ? "U" : m.draw && !m.pk ? "D" : m.res;
const compRound = m => [m.comp, m.round].filter(Boolean).join(" ");
const sides = m => m.ha==="A" ? {home:m.opp, away:clubName(), hs:m.ga, as:m.gf, hSide:"opp", aSide:"me"} : {home:clubName(), away:m.opp, hs:m.gf, as:m.ga, hSide:"me", aSide:"opp"};

function buildNews(){
  const N=[];
  D.played.forEach(m=>N.push({ id:"m"+m.id, cat:"MATCH", date:m.date, sort:m.date, m,
    title:`【${compRound(m)}】${m.opp}に${m.gf}-${m.ga}で${resWord(m)}` }));
  D.trans.forEach(t=>{
    const who=`${t.name}選手`;
    const tt={ "加入":`${who} 加入のお知らせ`, "レンタル加入":`${who} 期限付き移籍加入のお知らせ`, "昇格":`${who} トップチーム昇格のお知らせ`,
      "レンタル復帰":`${who} 期限付き移籍からの復帰のお知らせ`, "退団":`${who} 退団のお知らせ`, "レンタル移籍":`${who} 期限付き移籍のお知らせ`,
      "契約延長":`${who} 契約延長のお知らせ` }[t.kind] || `${who} ${t.kind}のお知らせ`;
    N.push({ id:"t"+t.i, cat:"TRANSFER", date:t.date, sort:t.date, t, title:tt });
  });
  D.seasons.forEach(S=>{
    const L=ofSeason(S.season); const last=L.length? L[L.length-1].date : null;
    const t=titlesOf(S);
    N.push({ id:"s"+S.season, cat:"SEASON", date:null, sort:last? new Date(last.getTime()+86400000) : null, S,
      title: t.length ? `${S.season}シーズン ${t.join("・")}！` : `${S.season}シーズンを終えて${S.rank?`（${S.league||"リーグ"} ${S.rank}位）`:""}` });
  });
  N.sort((a,b)=>(b.sort?b.sort.getTime():-1)-(a.sort?a.sort.getTime():-1));
  D.news=N;
}
function titlesOf(S){
  const t=[]; if(/^1$/.test(S.rank)) t.push(`${S.league||"リーグ"}優勝`);
  [["国内カップ",S.cup],["リーグカップ",S.lcup],["国際大会",S.intl]].forEach(([k,v])=>{ if(/^優勝/.test(v||"")) t.push(`${k}優勝`); });
  return t;
}
const mark = () => `<div class="nv-mark">${logo(clubName())}<span>${esc(clubName())}</span></div>`;
function visual(n){
  if(n.m){ const m=n.m, S=sides(m);
    return `<div class="nv m ${resCls(m)}">
      <div class="nv-comp">${esc(compRound(m))}</div><div class="nv-res">${resEN(m)}</div>
      <div class="nv-board"><div class="nv-team">${logo(S.home)}${esc(S.home)}</div>
        <div class="nv-score">${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}</div>
        <div class="nv-team">${logo(S.away)}${esc(S.away)}</div></div>
      <div class="nv-date">${fmtD(m.date)}</div>${mark()}</div>`; }
  if(n.t){ const t=n.t, P=profile(t.name), s=seasonRows(t.season).find(r=>same(r.name,t.name)) || latestStat(t.name);
    const dir=trDir(t.kind);
    const rows=[["NUMBER", s&&s.no!=null?s.no:""],["POSITION",(s&&s.pos)||(P&&P.pos)||""],["NATIONALITY",P&&P.nat||""],
      [dir==="out"?"NEXT CLUB":"PREVIOUS CLUB", t.club]].filter(r=>r[1]!=="" && r[1]!=null);
    return `<div class="nv t ${dir==="out"?"out":""}">
      <div class="nv-kind${(KIND_EN[t.kind]||t.kind).length>9?" long":""}">${esc(KIND_EN[t.kind]||t.kind)}<small>${esc(t.kind)}</small></div>
      <div class="nv-name">${esc(t.name)}</div>
      <dl class="nv-dl">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="nv-photo">${face(t.name)}</div>${mark()}</div>`; }
  const S=n.S, r=record(ofSeason(S.season)), t=titlesOf(S);
  return `<div class="nv s"><div class="nv-sn">${esc(S.season)} SEASON</div>
    <div class="nv-sbig">${S.rank?`${esc(S.rank)}<small>位</small>`:`${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small>`}</div>
    <div class="nv-stt">${t.length? t.map(x=>`<span>${esc(x)}</span>`).join("") : esc(S.league||"")}</div>${mark()}</div>`;
}
const nDate = n => n.date ? fmtD(n.date) : esc((n.S&&n.S.season)||"");
const newsCard = n => `<a class="ncard" href="#news/${encodeURIComponent(n.id)}"><div class="thumb">${visual(n)}</div>
  <div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span>${nDate(n)}</span></div><h3>${esc(n.title)}</h3></a>`;
const newsRow = n => `<a class="nrow" href="#news/${encodeURIComponent(n.id)}"><div class="thumb">${visual(n)}</div>
  <div><div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span>${nDate(n)}</span></div><h3>${esc(n.title)}</h3></div></a>`;
const pLink = n => `<a href="#player/${encodeURIComponent(n)}"><b>${esc(n)}</b></a>`;
function newsBody(n){
  const P=[];
  if(n.m){ const m=n.m;
    P.push(`<p>${fmtDW(m.date)}、${esc(compRound(m))}で${m.ha==="H"?"ホームに":m.ha==="A"?"アウェイで":"中立地で"}${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk?`（PK ${m.pk.a}-${m.pk.b}）`:""}で${resWord(m)}しました。</p>`);
    if(m.scorers.length) P.push(`<p>得点は${m.scorers.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}点）`:""}`).join("、")}。${m.assists.length?`アシストは${m.assists.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}）`:""}`).join("、")}が記録しました。`:""}</p>`);
    else if(m.gf===0) P.push(`<p>攻撃陣はゴールを奪えませんでした。</p>`);
    const po=teamVal(m,"me","ボール支配率"), sm=teamVal(m,"me","シュート"), so=teamVal(m,"opp","シュート");
    if(po!=null || (sm!=null&&so!=null)) P.push(`<p>${po!=null?`ボール支配率は${fmtV(po,0)}%`:""}${po!=null&&sm!=null&&so!=null?"、":""}${sm!=null&&so!=null?`シュートは${sm}本対${so}本`:""}でした。</p>`);
    if(m.mom) P.push(`<p>マン・オブ・ザ・マッチには${pLink(m.mom)}が選ばれました。</p>`);
    if(m.att) P.push(`<p>観客数：${nf(m.att)}人</p>`);
    if(m.memo) P.push(`<h2>監督コメント</h2><p>${esc(m.memo)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#match/${m.id}">MATCH DETAIL ›</a></div>`);
  } else if(n.t){ const t=n.t, dir=trDir(t.kind), club=t.club?esc(t.club):"";
    const s={ "加入":`${club?`${club}より、`:""}${pLink(t.name)}選手が加入することが決まりました。`,
      "レンタル加入":`${club?`${club}より、`:""}${pLink(t.name)}選手が期限付き移籍で加入することが決まりました。`,
      "昇格":`${pLink(t.name)}選手がトップチームに昇格することが決まりました。`,
      "レンタル復帰":`${club?`期限付き移籍先の${club}から、`:""}${pLink(t.name)}選手が復帰することが決まりました。`,
      "退団":`${pLink(t.name)}選手が${club?`${club}へ移籍し、`:""}チームを離れることになりました。`,
      "レンタル移籍":`${pLink(t.name)}選手が${club?`${club}へ`:""}期限付き移籍することになりました。`,
      "契約延長":`${pLink(t.name)}選手と契約を延長しました。` }[t.kind] || `${pLink(t.name)}選手：${esc(t.kind)}`;
    P.push(`<p>${s}</p>`);
    if(t.fee) P.push(`<p>移籍金：${money(t.fee)}</p>`);
    const pr=profile(t.name);
    if(pr){ const it=[pr.pos&&`ポジション：${esc(pr.pos)}`, pr.nat&&`国籍：${esc(pr.nat)}`, pr.birth&&`年齢：${ageAt(pr.birth,t.season)}歳`, pr.height&&`身長：${pr.height}cm`, pr.foot&&`利き足：${esc(pr.foot)}`].filter(Boolean);
      if(it.length) P.push(`<h2>プロフィール</h2><p>${it.join("<br>")}</p>`); }
    if(t.memo) P.push(`<h2>メモ</h2><p>${esc(t.memo)}</p>`);
    if(dir!=="out") P.push(`<div class="nd-link"><a class="btn" href="#player/${encodeURIComponent(t.name)}">PLAYER PROFILE ›</a></div>`);
  } else { const S=n.S, r=record(ofSeason(S.season));
    P.push(`<p>${esc(S.season)}シーズンが終了しました。${S.league?`${esc(S.league)}は${S.rank?`${esc(S.rank)}位`:""}`:""}${r.n?`、公式戦${r.n}試合で${r.w}勝${r.d}分${r.l}敗（${r.gf}得点・${r.ga}失点）`:""}でした。</p>`);
    const cups=[["国内カップ",S.cup],["リーグカップ",S.lcup],["国際大会",S.intl]].filter(x=>x[1]);
    if(cups.length) P.push(`<p>${cups.map(([k,v])=>`${k}：${esc(v)}`).join("<br>")}</p>`);
    const top=topOf(S.season,"g"); if(top) P.push(`<p>チーム得点王は${pLink(top.name)}（${top.g}点）。</p>`);
    if(S.cap) P.push(`<p>主将：${pLink(S.cap)}</p>`);
    if(S.comment) P.push(`<h2>監督コメント</h2><p>${esc(S.comment)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#history">CLUB HISTORY ›</a></div>`);
  }
  return P.join("");
}

/* =====================================================================
   画面
   ===================================================================== */
function seasonSel(id, val, all){
  const opts=(all?[["","通算"]]:[]).concat(D.seasonList.map(s=>[s,`${s}シーズン`]));
  if(!opts.length) return "";
  return `<select class="sel" id="${id}" aria-label="シーズンを選ぶ">${opts.map(([v,l])=>`<option value="${esc(v)}"${v===(val||"")?" selected":""}>${esc(l)}</option>`).join("")}</select>`;
}
const bindSel = (id, fn) => { const el=$(id); if(el) el.onchange=()=>fn(el.value); };
const band = (en, jp) => `<section class="ph-band" data-bg="${esc(en)}"><div class="ph-in"><h1><b>${esc(en)}</b><small>${esc(jp)}</small></h1></div></section>`;
const secH = (en, jp, more) => `<div class="sec-h"><h2><b>${en}</b><small>${jp}</small></h2>${more?`<a class="more" href="${more}">VIEW MORE</a>`:""}</div>`;
const dateEN = d => d ? `<b>${d.getMonth()+1}.${String(d.getDate()).padStart(2,"0")}<small>${WDE[d.getDay()]}</small></b>` : "<b>--</b>";

/* 試合カード（HOME） */
function matchBox(m, label){
  const S=sides(m);
  return `<div class="mbox"><div class="mbox-h"><b>${label}</b><span class="ha ${m.ha}" style="color:#fff">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
    <a class="mbox-b" href="#match/${m.id}">
      <div class="mdate">${dateEN(m.date)}<span style="font-size:12px;color:var(--ink2);font-weight:700">${m.date?m.date.getFullYear():""}</span></div>
      <div class="mcomp">${esc(compRound(m))}</div>
      <div class="mboard"><div class="mteam">${logo(S.home)}${esc(S.home)}</div>
        <div class="mscore">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}`:`<span class="vs">VS</span>`}</div>
        <div class="mteam">${logo(S.away)}${esc(S.away)}</div></div>
      ${m.played?`<div class="mres"><span class="res ${resCls(m)}">${resEN(m)}</span></div>`:""}
    </a>
    <div class="mlinks">${m.played?`<a href="#match/${m.id}">試合詳細</a>${hasStats(m)?`<a href="#match/${m.id}/stats">スタッツ</a>`:""}${m.lu.me.length?`<a href="#match/${m.id}/lineup">出場選手</a>`:""}`
      :`<a href="#match">試合日程</a><a href="#match/${m.id}">対戦情報</a>`}</div></div>`;
}

/* ---------- HOME ---------- */
let sliderTimer=null;
function vHome(){
  const s=ST.season, r=record(ofSeason(s)), rk=myRank(s), lg=leagueName(s);
  const next=D.matches.find(m=>!m.played), last=D.played.slice(-2).reverse();
  const boxes=[]; if(next) boxes.push(matchBox(next,"NEXT MATCH")); if(last[0]) boxes.push(matchBox(last[0],"LATEST RESULT")); if(!next && last[1]) boxes.push(matchBox(last[1],"PREVIOUS RESULT"));
  const slides=D.news.slice(0,5);
  const leaders=[["TOP SCORER","g","点"],["TOP ASSIST","a",""],["CHANCE CREATE","チャンスクリエイト","回"]].map(([l,k,u])=>{
    let rows=statRowsFor(s).filter(x=>x[k]); if(!rows.length) rows=fromMatches(s).filter(x=>x[k]);
    rows.sort((a,b)=>b[k]-a[k]); const t=rows[0]; if(!t) return "";
    return `<a class="leader" href="#player/${encodeURIComponent(t.name)}">${face(t.name)}<div><span>${l}</span><b>${esc(t.name)}</b><em>${t[k]}<small>${u}</small></em></div></a>`;
  }).join("");
  const tb=standing(s, null, true);
  return `
  <section class="hero"><div class="hero-in">
    ${slides.length?`<div class="slider"><div class="slides" id="slides">${slides.map(n=>`<a class="slide" href="#news/${encodeURIComponent(n.id)}">${visual(n)}
        <div class="slide-cap"><div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span class="en" style="font-weight:600">${nDate(n)}</span></div><h3>${esc(n.title)}</h3></div></a>`).join("")}</div>
      ${slides.length>1?`<div class="dots" id="dots">${slides.map((_,i)=>`<button aria-label="${i+1}枚目"${i?"":' class="on"'}></button>`).join("")}</div>`:""}</div>`
    :`<div style="aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;position:relative">${logo(clubName(),"")}<b class="en" style="font-size:48px;font-weight:800;font-style:italic;letter-spacing:.04em">${esc(clubName().toUpperCase())}</b></div>`}
    <div class="hero-side"><h2>NEWS<small>最新ニュース</small></h2>
      ${D.news.slice(0,5).map(n=>`<a class="hl" href="#news/${encodeURIComponent(n.id)}"><div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span class="en">${nDate(n)}</span></div><p>${esc(n.title)}</p></a>`).join("")||`<p style="font-size:13px;opacity:.7;margin-top:10px">スプシに試合や移籍を入れると、ここにニュースが並びます。</p>`}
    </div></div></section>

  <section class="match-band"><div class="wrap">
    ${secH("MATCH","試合日程・結果","#match")}
    ${boxes.length?`<div class="mgrid">${boxes.join("")}</div>`:empty("試合シートに入れると、ここに試合が出ます。")}
    <div class="season-strip">
      <div><span>${esc(s||"SEASON")} 成績</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div>
      <div><span>${esc(lg||"リーグ")} 順位</span><b>${rk?`${esc(rk)}<small>位</small>`:"-"}</b></div>
      <div><span>得点</span><b>${r.gf}</b></div><div><span>失点</span><b>${r.ga}</b></div>
    </div>
  </div></section>

  <div class="wrap">
    <section class="sec">${secH("NEWS","ニュース","#news")}
      ${D.news.length?`<div class="ngrid">${D.news.slice(0,8).map(newsCard).join("")}</div>`:empty("試合・移籍・シーズンのシートに入れると、ニュースが自動でできます。")}</section>
    ${leaders?`<section class="sec">${secH("PLAYERS","今シーズンの主な選手","#players")}<div class="leaders">${leaders}</div></section>`:""}
    ${tb?`<section class="sec">${secH("STANDINGS","順位表","#history")}${tb}</section>`:""}
  </div>`;
}
function bHome(){
  const box=$("slides"), dots=$("dots"); if(!box) return;
  const btns=dots?[...dots.children]:[];
  const kids=[...box.children];
  const cur=()=>{ let b=0,d=1e9; kids.forEach((k,i)=>{ const x=Math.abs(k.offsetLeft-box.offsetLeft-box.scrollLeft-(kids[0].offsetLeft-box.offsetLeft)); if(x<d){d=x;b=i;} }); return b; };
  const go=i=>box.scrollTo({left:kids[i].offsetLeft-kids[0].offsetLeft});
  btns.forEach((b,i)=>b.onclick=e=>{ e.preventDefault(); go(i); restart(); });
  box.addEventListener("scroll",()=>{ const i=cur(); btns.forEach((b,k)=>b.classList.toggle("on",k===i)); },{passive:true});
  const restart=()=>{ clearInterval(sliderTimer); if(kids.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    sliderTimer=setInterval(()=>{ if(!document.body.contains(box)){ clearInterval(sliderTimer); return; } const i=cur(); go(i>=kids.length-1 || box.scrollLeft+box.clientWidth>=box.scrollWidth-4 ? 0 : i+1); },6000); };
  restart();
}

/* ---------- NEWS ---------- */
function vNews(){
  const cats=["すべて","MATCH","TRANSFER","SEASON"];
  const L=D.news.filter(n=>ST.newsCat==="すべて"||n.cat===ST.newsCat);
  return `${band("NEWS","ニュース")}<div class="wrap narrow">
    <div class="pill-tabs" id="nw-tabs">${cats.map(c=>`<button class="pill${c===ST.newsCat?" on":""}" data-c="${c}">${c==="すべて"?"ALL":c}</button>`).join("")}</div>
    ${L.length?`<div class="nlist">${L.map(newsRow).join("")}</div>`:empty("まだニュースはありません。")}</div>`;
}
function bNews(){ document.querySelectorAll("#nw-tabs .pill").forEach(b=>b.onclick=()=>{ ST.newsCat=b.dataset.c; render(); }); }
function vNewsDetail(id){
  const n=D.news.find(x=>x.id===id); if(!n) return `${band("NEWS","ニュース")}<div class="wrap narrow">${empty("ニュースが見つかりません。")}</div>`;
  const i=D.news.indexOf(n), nx=D.news[i-1], pv=D.news[i+1];
  return `${band("NEWS","ニュース")}<div class="wrap narrow">
    <div class="crumb"><a href="#home">HOME</a> › <a href="#news">NEWS</a></div>
    <article><div class="nd-head"><div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span>${n.date?fmtDW(n.date):nDate(n)}</span></div><h1>${esc(n.title)}</h1></div>
      ${visual(n)}<div class="nd-body">${newsBody(n)}</div></article>
    <div class="pager">${pv?`<a href="#news/${encodeURIComponent(pv.id)}"><small>‹ PREV</small>${esc(pv.title)}</a>`:"<span></span>"}${nx?`<a class="nx" href="#news/${encodeURIComponent(nx.id)}"><small>NEXT ›</small>${esc(nx.title)}</a>`:""}</div></div>`;
}

/* ---------- MATCH ---------- */
function vMatch(){
  const s=ST.season, L0=D.matches.filter(m=>!s || m.season===s), comps=["すべて",...new Set(L0.map(m=>m.comp))];
  if(!comps.includes(ST.comp)) ST.comp="すべて";
  const L=L0.filter(m=>ST.comp==="すべて"||m.comp===ST.comp), r=record(L.filter(m=>m.played));
  return `${band("MATCH","試合日程・結果")}<div class="wrap">
    <div class="toolbar">${seasonSel("mt-season", s)}</div>
    <div class="pill-tabs" id="mt-tabs">${comps.map(c=>`<button class="pill${c===ST.comp?" on":""}" data-c="${esc(c)}">${c==="すべて"?"ALL":esc(c)}</button>`).join("")}</div>
    ${r.n?`<div class="chips"><div class="chip"><span>試合</span><b>${r.n}</b></div><div class="chip"><span>勝-分-敗</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div>
      <div class="chip"><span>得点</span><b>${r.gf}</b></div><div class="chip"><span>失点</span><b>${r.ga}</b></div><div class="chip"><span>無失点</span><b>${r.cs}</b></div></div>`:""}
    ${L.length?`<div class="mlist">${L.map(m=>{ const S=sides(m);
      return `<a class="mrow" href="#match/${m.id}">
        <div class="mrow-d">${dateEN(m.date)}<span>${esc(m.comp)}<br>${esc(m.round)}</span></div>
        <div class="mrow-t r"><span>${esc(S.home)}</span>${logo(S.home)}</div>
        <div class="mrow-s">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}`:`<span class="vs">VS</span>`}</div>
        <div class="mrow-t">${logo(S.away)}<span>${esc(S.away)}</span></div>
        <div class="mrow-r"><span class="ha ${m.ha}">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"N"}</span> <span class="res ${resCls(m)}">${m.played?(m.draw&&!m.pk?"D":m.res):"NEXT"}</span></div></a>`; }).join("")}</div>`
      :empty("試合シートに入れると、ここに試合が並びます。")}</div>`;
}
function bMatch(){ bindSel("mt-season", v=>{ ST.season=v; render(); }); document.querySelectorAll("#mt-tabs .pill").forEach(b=>b.onclick=()=>{ ST.comp=b.dataset.c; render(); }); }

/* 試合のスタッツ（Jリーグ公式の試合スタッツ＋FotMob）。[項目, 単位, 小数, 少ないほうが良い, 計算式] */
const MS = [
  ["試合記録", [["シュート"],["枠内シュート"],["ビッグチャンス"],["コーナーキック"],["直接FK"],["間接FK"],["オフサイド","",0,1],["PK"],["ゴールキック"],["スローイン"]]],
  ["シュート", [["枠外シュート"],["ブロックされたシュート"],["ポスト・バー"],["PA内シュート"],["PA外シュート"],["ビッグチャンス逸機","",0,1]]],
  ["ゴール期待値", [["ゴール期待値","",2],["流れからのゴール期待値","",2],["セットプレーからのゴール期待値","",2],["PKを除くゴール期待値","",2],["枠内ゴール期待値","",2]]],
  ["攻撃", [["パス"],["パス成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"パス成功"),teamVal(m,s,"パス"))],["敵陣パス"],["敵陣パス成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"敵陣パス成功"),teamVal(m,s,"敵陣パス"))],
    ["ロングパス"],["ロングパス成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"ロングパス成功"),teamVal(m,s,"ロングパス"))],
    ["ドリブル"],["ドリブル成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"ドリブル成功"),teamVal(m,s,"ドリブル"))],
    ["スルーパス"],["スルーパス成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"スルーパス成功"),teamVal(m,s,"スルーパス"))],["クロス"],["クロス成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"クロス成功"),teamVal(m,s,"クロス"))],
    ["PA内タッチ"],["チャンスクリエイト"]]],
  ["守備", [["タックル"],["タックル成功率","%",1,0,(m,s)=>rate(teamVal(m,s,"タックル成功"),teamVal(m,s,"タックル"))],["インターセプト"],["ブロック"],["クリア"],["セーブ"],
    ["空中戦勝利"],["空中戦勝率","%",1,0,(m,s)=>rate(teamVal(m,s,"空中戦勝利"),teamVal(m,s,"空中戦"))],["デュエル勝利"],["1vs1勝利"],["こぼれ球奪取"],
    ["シュートにつながるミス","",0,1],["失点につながるミス","",0,1],["ファウル","",0,1],["警告","",0,1],["退場","",0,1]]],
  ["フィジカル", [["走行距離","km",1],["スプリント"],["Atスプリント"],["Mtスプリント"],["Dtスプリント"],["ポゼッション時走行距離","km",1],["ポゼッション時スプリント"],["被ポゼッション時走行距離","km",1],["被ポゼッション時スプリント"]]]
];
const msVal = (m,side,it) => it[4] ? it[4](m,side) : teamVal(m,side,it[0]);
const hasStats = m => teamVal(m,"me","ボール支配率")!=null || MS.some(([,L])=>L.some(it=>msVal(m,"me",it)!=null||msVal(m,"opp",it)!=null));

function vMatchDetail(arg){
  const [id, tab]=String(arg).split("/");
  const m=D.matches.find(x=>x.id===+id); if(!m) return `${band("MATCH","試合")}<div class="wrap">${empty("試合が見つかりません。")}</div>`;
  if(tab) ST.mtab=tab;
  const S=sides(m), hasLu=m.lu.me.length||m.lu.opp.length, hasEv=m.ev.length;
  const T=[["sum","SUMMARY","概要",true],["stats","STATS","スタッツ",hasStats(m)],["lineup","LINE-UP","出場選手",hasLu],["timeline","TIMELINE","経過",hasEv]];
  if(!T.find(t=>t[0]===ST.mtab && t[3])) ST.mtab="sum";
  const goalsOf = side => side==="me" ? m.scorers.map(x=>`${esc(x.name)}${x.n>1?` ×${x.n}`:""}`)
    : m.ev.filter(e=>e.side==="opp"&&isGoal(e)).map(e=>`${esc(e.player)} ${esc(e.min)}'`)
      .concat(m.lu.opp.filter(l=>l.g&&!m.ev.some(e=>e.side==="opp"&&isGoal(e))).map(l=>`${esc(l.name)}${l.g>1?` ×${l.g}`:""}`));
  const pv=D.matches.find(x=>x.id===m.id-1), nx=D.matches.find(x=>x.id===m.id+1);
  let body="";
  if(ST.mtab==="stats") body=tabStats(m,S); else if(ST.mtab==="lineup") body=tabLineup(m,S); else if(ST.mtab==="timeline") body=tabTimeline(m,S); else body=tabSummary(m);
  return `<section class="mh"><div class="mh-in">
      <div class="mh-comp">${esc(compRound(m))}</div><div class="mh-date">${m.date?`${fmtD(m.date)} ${WDE[m.date.getDay()]}`:""}　<span class="ha ${m.ha}" style="color:#fff">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
      <div class="mh-board"><div class="mh-team">${logo(S.home)}${esc(S.home)}</div>
        <div class="mh-score">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b} - ${m.pk.a}`:`${m.pk.a} - ${m.pk.b}`}</small>`:""}`:`<span style="font-size:.5em;font-style:italic;opacity:.6">VS</span>`}</div>
        <div class="mh-team">${logo(S.away)}${esc(S.away)}</div></div>
      ${m.played?`<div class="mh-res"><span class="res ${resCls(m)}">${resEN(m)}</span></div>
      <div class="mh-goals"><ul class="r">${goalsOf(S.hSide).map(x=>`<li>${x} ⚽</li>`).join("")}</ul><ul>${goalsOf(S.aSide).map(x=>`<li>⚽ ${x}</li>`).join("")}</ul></div>`:""}
    </div></section>
    ${m.played?`<nav class="mtabs"><div class="mtabs-in">${T.map(([k,en,jp,ok])=>`<button data-t="${k}"${k===ST.mtab?' class="on"':""}${ok?"":" disabled"}>${en}<small>${jp}</small></button>`).join("")}</div></nav>`:""}
    <div class="wrap" style="max-width:1000px">
      <div class="crumb"><a href="#home">HOME</a> › <a href="#match">MATCH</a></div>
      ${m.played?body:empty("これからの試合です。結果を入れると、ここに詳しい記録が出ます。")}
      <div class="pager">${pv?`<a href="#match/${pv.id}"><small>‹ PREV</small>${fmtMD(pv.date)} vs ${esc(pv.opp)}</a>`:"<span></span>"}${nx?`<a class="nx" href="#match/${nx.id}"><small>NEXT ›</small>${fmtMD(nx.date)} vs ${esc(nx.opp)}</a>`:""}</div>
    </div>`;
}
function bMatchDetail(){ document.querySelectorAll(".mtabs button").forEach(b=>b.onclick=()=>{ if(b.disabled) return; ST.mtab=b.dataset.t;
  const id=parseHash().arg.split("/")[0]; history.replaceState(null,"",`#match/${id}${ST.mtab==="sum"?"":"/"+ST.mtab}`); render(); });
  document.querySelectorAll("#lu-side .pill").forEach(b=>b.onclick=()=>{ ST.luSide=b.dataset.s; render(); });
  document.querySelectorAll("#lu-grp .tab").forEach(b=>b.onclick=()=>{ ST.luGrp=b.dataset.g; render(); }); }

function tabSummary(m){
  const list=(L)=> L.length? `<ul>${L.map(x=>`<li><a href="#player/${encodeURIComponent(x.name)}">${esc(x.name)}</a>${x.n>1?` ×${x.n}`:""}</li>`).join("")}</ul>` : `<p style="color:var(--ink3);font-size:13px">なし</p>`;
  return `<div class="box-grid">
      <div class="box"><h3>GOAL<small>得点者</small></h3>${list(m.scorers)}</div>
      <div class="box"><h3>ASSIST<small>アシスト</small></h3>${list(m.assists)}</div>
      ${m.mom?`<a class="box mom" href="#player/${encodeURIComponent(m.mom)}">${face(m.mom)}<div><h3 style="margin-bottom:2px">MAN OF THE MATCH</h3><b>${esc(m.mom)}</b></div></a>`:""}
      ${m.att?`<div class="box"><h3>ATTENDANCE<small>入場者数</small></h3><b class="en" style="font-size:36px;font-weight:800">${nf(m.att)}</b> 人</div>`:""}
    </div>
    ${m.memo?`<div class="memo">${esc(m.memo)}</div>`:""}
    ${hasStats(m)?`<div style="margin-top:28px">${tabStats(m, sides(m), true)}</div>`:""}`;
}
function cmpRow(label, a, b, u, d, low){
  if(a==null && b==null) return "";
  const x=a||0, y=b||0, mx=Math.max(x,y,0.0001);
  const better = low ? (x<y?"h":y<x?"a":"") : (x>y?"h":y>x?"a":"");
  const pctLike = u==="%";
  const wa = pctLike ? Math.min(100,x) : x/mx*100, wb = pctLike ? Math.min(100,y) : y/mx*100;
  const f = v => v==null ? "-" : fmtV(v,d)+(u==="%"?"%":"");
  return `<div class="cmp"><div class="cmp-v${better==="h"?" win":""}">${f(a)}</div>
    <div class="cmp-m"><span>${label}${u&&u!=="%"?`（${u}）`:""}</span><div class="cmp-bar"><i><b style="width:${wa}%"></b></i><i><b style="width:${wb}%"></b></i></div></div>
    <div class="cmp-v r${better==="a"?" win":""}">${f(b)}</div></div>`;
}
function tabStats(m,S,short){
  const H=S.hSide, A=S.aSide;
  const poss=[teamVal(m,H,"ボール支配率"), teamVal(m,A,"ボール支配率")];
  const head=`<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}${m.form[H]?` <span class="form-tag">${esc(m.form[H])}</span>`:""}</div><div></div><div class="r">${m.form[A]?`<span class="form-tag">${esc(m.form[A])}</span> `:""}${esc(S.away)} ${logo(S.away)}</div></div>`;
  const posHtml = (poss[0]!=null||poss[1]!=null) ? `<div class="poss"><div class="poss-bar"><i style="width:${poss[0]??(100-(poss[1]||0))}%"><b>${fmtV(poss[0]??(100-poss[1]),0)}%</b></i><i><b>${fmtV(poss[1]??(100-poss[0]),0)}%</b></i></div><span>ボール支配率</span></div>` : "";
  const groups = short ? [MS[0]] : MS;
  const body = groups.map(([g,L])=>{ const rows=L.map(it=>cmpRow(it[0], msVal(m,H,it), msVal(m,A,it), it[1]||"", it[2]||0, it[3])).join("");
    return rows ? `<div class="sub-h">${esc(g)}</div>${rows}` : ""; }).join("");
  if(!body && !posHtml) return empty("チームスタッツか出場選手のシートに入れると、ここに比較が出ます。");
  return `${head}${posHtml}${body}${short?`<p style="margin-top:16px"><a class="btn" href="#match/${m.id}/stats">ALL STATS ›</a></p>`:""}`;
}
/* フォーメーションに合わせて、先発11人をピッチに並べる */
function placeXI(L, form){
  const st=L.filter(l=>l.role==="先発");
  if(!st.length) return [];
  const gk=st.filter(l=>posGroup(l.pos)==="GK"), out=st.filter(l=>posGroup(l.pos)!=="GK")
    .map((l,i)=>({l,i,d:POS_DEPTH[l.pos]!=null?POS_DEPTH[l.pos]:2.5,lat:POS_LAT(l.pos)})).sort((a,b)=>a.d-b.d || a.i-b.i);
  let rows=[];
  const cnt=String(form||"").split("-").map(Number).filter(n=>n>0);
  if(cnt.length && cnt.reduce((a,b)=>a+b,0)===out.length){ let k=0; cnt.forEach(c=>{ rows.push(out.slice(k,k+c)); k+=c; }); }
  else { const g={}; out.forEach(o=>{ const b=Math.round(o.d); (g[b]=g[b]||[]).push(o); }); rows=Object.keys(g).sort().map(k=>g[k]); }
  const P=[]; gk.forEach((l,j)=>P.push({l,x:50+(j-(gk.length-1)/2)*20,y:90}));
  const n=rows.length;
  rows.forEach((row,ri)=>{ const y= n===1? 45 : 72 - ri*(58/(n-1));
    row.sort((a,b)=>a.lat-b.lat || a.i-b.i).forEach((o,j)=>P.push({l:o.l, x: 10 + 80*(j+.5)/row.length, y, w: 78/row.length})); });
  return P;
}
/* 名前を省略せず、「・」や空白のところで折り返す */
const brk = s => esc(s).replace(/([・･\s])/g,"$1<wbr>");
function pitchHtml(L, form, side, m){
  const P=placeXI(L, form);
  if(!P.length) return "";
  return `<div class="pitch"><div class="arc"></div>${P.map(({l,x,y,w})=>{
    const off = m.ev.some(e=>e.side===side&&e.kind==="交代"&&same(e.rel,l.name)) || (l.min!=null && l.min<90 && l.role==="先発");
    const ic=`${l.g?"⚽".repeat(Math.min(l.g,3)):""}${l.yc?'<i class="ico-y"></i>':""}${l.rc?'<i class="ico-r"></i>':""}`;
    const inner=`<div class="pp-s">${l.no??""}${off?'<span class="pp-off" title="交代">▼</span>':""}${ic?`<span class="pp-i">${ic}</span>`:""}</div><span class="pp-n">${brk(side==="me"?surname(l.name):l.name)}</span>`;
    return `<div class="pp ${side==="opp"?"opp":""} ${posGroup(l.pos)==="GK"?"gk":""}" style="left:${x}%;top:${y}%;width:${Math.min(24,w||24).toFixed(1)}%">${side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${inner}</a>`:inner}</div>`; }).join("")}</div>`;
}
/* 出場選手の表（Jリーグの分類で切り替え） */
const LU_GRP = [
  ["攻撃", [["出場時間","分"],["得点"],["アシスト"],["シュート"],["枠内シュート"],["ゴール期待値","",2],["枠内ゴール期待値","",2],["期待アシスト","",2],["チャンスクリエイト"],["ビッグチャンス創出"],["ビッグチャンス逸機"],["タッチ"],["PA内タッチ"]]],
  ["パス", [["パス"],["パス成功率","%",1,l=>rate(l.s["パス成功"],l.s["パス"])],["敵陣パス"],["ファイナルサードへのパス"],["ロングパス"],["スルーパス"],["クロス"],["ドリブル"],["ドリブル成功率","%",1,l=>rate(l.s["ドリブル成功"],l.s["ドリブル"])],["ボールロスト"],["プレー数"]]],
  ["守備", [["タックル"],["タックル成功率","%",1,l=>rate(l.s["タックル成功"],l.s["タックル"])],["インターセプト"],["ブロック"],["クリア"],["空中戦勝利"],["デュエル勝利"],["デュエル敗北"],["こぼれ球奪取"],["抜かれた回数"],["ファウル"],["被ファウル"],["オフサイド"],["警告"],["退場"]]],
  ["GK", [["被シュート"],["被枠内シュート"],["失点"],["セーブ"],["セーブ率","%",1,l=>rate(l.s["セーブ"],l.s["被枠内シュート"])],["被枠内ゴール期待値","",2],["防いだ失点","",2,l=>l.s["被枠内ゴール期待値"]!=null?l.s["被枠内ゴール期待値"]-(l.s["失点"]||0):null],["ダイビングセーブ"],["飛び出し"],["ハイボール処理"],["クロスキャッチ"],["クロスパンチング"],["スロー"]]],
  ["フィジカル", [["走行距離","km",2],["ランニング距離","km",2],["スプリント距離","km",2],["トップスピード","km/h",1],["スプリント"],["Atスプリント"],["Mtスプリント"],["Dtスプリント"]]]
];
function tabLineup(m,S){
  const col = side => { const L=m.lu[side], club= side==="me"?clubName():m.opp, form=m.form[side];
    if(!L.length) return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span></div>${empty("出場選手シートに入れると表示されます。")}</div>`;
    const subs=L.filter(l=>l.role==="途中出場"), bench=L.filter(l=>l.role==="ベンチ");
    const nm=l=> side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${esc(l.name)}</a>`:esc(l.name);
    const offFor = l => { const e=m.ev.find(e=>e.side===side&&e.kind==="交代"&&same(e.player,l.name)); return e ? `${esc(e.min)}' OUT ${esc(e.rel)}` : (l.min!=null?`${l.min}分`:""); };
    return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span>${form?`<span class="form-tag">${esc(form)}</span>`:""}</div>
      ${pitchHtml(L, form, side, m)}
      ${subs.length?`<div class="subs"><h4>SUBSTITUTES <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">途中出場</small></h4><ul>${subs.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}　${offFor(l)}</small></li>`).join("")}</ul></div>`:""}
      ${bench.length?`<div class="subs"><h4>BENCH <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">ベンチ</small></h4><ul>${bench.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}</small></li>`).join("")}</ul></div>`:""}</div>`; };
  const side=ST.luSide==="opp"?"opp":"me";
  const grps=LU_GRP.filter(([,C])=>m.lu[side].some(l=>C.some(c=>(c[3]?c[3](l):l.s[c[0]])!=null)));
  const g=grps.find(x=>x[0]===ST.luGrp)||grps[0];
  let L=m.lu[side].filter(l=>l.role!=="ベンチ");
  if(g && g[0]==="GK") L=L.filter(l=>posGroup(l.pos)==="GK");
  const cols= g ? g[1].filter(c=>L.some(l=>(c[3]?c[3](l):l.s[c[0]])!=null)) : [];
  const cell=(l,c)=>{ const v=c[3]?c[3](l):l.s[c[0]]; if(v==null) return ""; if(c[0]==="警告") return v?'<i class="ico-y"></i>':""; if(c[0]==="退場") return v?'<i class="ico-r"></i>':""; return fmtV(v,c[2]||0)+(c[1]==="%"?"%":""); };
  return `<div class="lu-grid">${col(S.hSide)}${col(S.aSide)}</div>
    <div class="sub-h">PLAYER STATS<small>選手ごとの記録</small></div>
    <div class="pill-tabs" id="lu-side"><button class="pill${side==="me"?" on":""}" data-s="me">${esc(clubName())}</button><button class="pill${side==="opp"?" on":""}" data-s="opp">${esc(m.opp)}</button></div>
    ${g?`<div class="tabs" id="lu-grp">${grps.map(([k])=>`<button class="tab${k===g[0]?" on":""}" data-g="${k}">${k}</button>`).join("")}</div>
      <div class="tw"><table class="t"><thead><tr><th class="l">名前</th><th>#</th><th>POS</th>${cols.map(c=>`<th>${c[0]}${c[1]&&c[1]!=="%"?`<br><small>${c[1]}</small>`:""}</th>`).join("")}</tr></thead><tbody>
      ${L.slice().sort((a,b)=>({"先発":0,"途中出場":1}[a.role]??2)-({"先発":0,"途中出場":1}[b.role]??2) || (POS_DEPTH[a.pos]??5)-(POS_DEPTH[b.pos]??5)).map(l=>`<tr><th class="l">${side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${esc(l.name)}</a>`:esc(l.name)}${l.role==="途中出場"?' <small style="color:var(--ink3)">途中</small>':""}${same(l.name,m.mom)&&side==="me"?' <span class="cat">MOM</span>':""}</th><td class="num">${l.no??""}</td><td>${esc(l.pos)}</td>${cols.map(c=>`<td class="num">${cell(l,c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : empty("出場選手シートに入れると表示されます。")}`;
}
function tabTimeline(m,S){
  const kcls = k => isGoal({kind:k})?"goal" : k==="警告"?"y" : k==="退場"?"r" : k==="交代"?"sub" : "";
  const ev=m.ev; let ht=false;
  const rows=[];
  ev.forEach(e=>{
    if(!ht && e.mn>45.99 && ev.some(x=>x.mn<=45.99)){ rows.push(`<div class="tl-ht"><span>HALF TIME</span></div>`); ht=true; }
    const isHome = (e.side===S.hSide);
    const who = e.side==="me" ? (e.player?pLink(e.player):"") : (e.player?`<b>${esc(e.player)}</b>`:"");
    const sub = e.kind==="交代" ? (e.rel?`<small>OUT ${esc(e.rel)}</small>`:"") : isGoal(e) ? `<small>${[e.body, e.rel?`アシスト ${esc(e.rel)}`:""].filter(Boolean).join("・")}</small>` : "";
    const txt=`<span class="tl-k ${kcls(e.kind)}">${esc(e.kind)}</span>${who}${sub}${e.note?`<small>${esc(e.note)}</small>`:""}`;
    rows.push(`<div class="tl-r"><div class="tl-e me">${isHome?txt:""}</div><div class="tl-m">${esc(e.min)}'</div><div class="tl-e">${isHome?"":txt}</div></div>`);
  });
  return `<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}</div><div></div><div class="r">${esc(S.away)} ${logo(S.away)}</div></div><div class="tl">${rows.join("")}<div class="tl-ht"><span>FULL TIME</span></div></div>`;
}

/* ---------- PLAYERS ---------- */
function squad(s){
  let rows=seasonRows(s).map(r=>({...r, prof:profile(r.name)}));
  /* 選手シートにいて、まだ出場していない選手も並べる */
  D.players.forEach(p=>{ if(!rows.some(r=>same(r.name,p.name)) && !D.trans.some(t=>same(t.name,p.name)&&trDir(t.kind)==="out"&&(!s||t.season<=s))) rows.push({name:p.name,pos:p.pos,no:null,prof:p,apps:0}); });
  return {rows, note:""};
}
function vPlayers(){
  const s=ST.season, {rows, note}=squad(s);
  const by={}; rows.forEach(r=>{ const g=posGroup((r.prof&&r.prof.pos)||r.pos); (by[g]=by[g]||[]).push(r); });
  Object.values(by).forEach(L=>L.sort((a,b)=>(a.no??999)-(b.no??999) || a.name.localeCompare(b.name,"ja")));
  return `${band("PLAYERS","選手一覧")}<div class="wrap">
    <div class="toolbar">${seasonSel("pl-season", s)}</div>
    ${rows.length? GROUPS.filter(([g])=>by[g]).map(([g,en,jp])=>`<div class="pos-h"><b>${en}</b><small>${jp}</small></div>
      <div class="pgrid">${by[g].map(r=>`<a class="pcard" href="#player/${encodeURIComponent(r.name)}"><div class="pic">${face(r.name)}
        ${r.no!=null?`<span class="no">${r.no}</span>`:""}</div>
        <div class="pos">${esc((r.prof&&r.prof.pos)||r.pos||"")}</div><b>${esc(r.name)}</b><small>${r.apps?`${r.apps}試合 ${r.g||0}得点`:"出場なし"}</small></a>`).join("")}</div>`).join("")
      : empty("選手シート・出場選手シートに入れると、ここに選手が並びます。")}
    ${note?`<p class="note">${esc(note)}</p>`:""}</div>`;
}
function bPlayers(){ bindSel("pl-season", v=>{ ST.season=v; render(); }); }
function vPlayerDetail(name){
  name=fullName(name);
  const P=profile(name), L=seasonsOfPlayer(name), last=L[L.length-1];
  const log=D.lineups.filter(l=>l.side==="me" && same(l.name,name) && l.m && l.m.played).sort((a,b)=>a.m.id-b.m.id);
  const mg=D.played.filter(m=>m.scorers.some(x=>same(x.name,name)) || m.assists.some(x=>same(x.name,name)) || same(m.mom,name));
  const T=D.trans.filter(t=>same(t.name,name));
  if(!P && !L.length && !mg.length && !T.length && !log.length) return `${band("PLAYERS","選手")}<div class="wrap">${empty("選手が見つかりません。")}</div>`;
  const pos=(P&&P.pos)||(last&&last.pos)||"";
  const prof=[["国籍",P&&P.nat],["生年月日",P&&P.birth?`${fmtD(P.birth)}（${ageAt(P.birth,ST.season||D.seasonList[0])}歳）`:P&&P.birthS],
    ["利き足",P&&P.foot],["身長",P&&P.height?`${P.height}cm`:""]].filter(([,v])=>v!=null&&v!=="");
  /* 表示するシーズン（通算も選べる） */
  const seasons=L.map(r=>r.season);
  const ps = ST.pSeason!=null && (ST.pSeason==="" || seasons.includes(ST.pSeason)) ? ST.pSeason : (last?last.season:"");
  const Tt = ps ? L.find(r=>r.season===ps) : luAgg("").find(r=>same(r.name,name));
  const isGK=posGroup(pos)==="GK";
  const groups = Tt ? PM.filter(([g])=> g!=="GK" || isGK).map(([g,Ls])=>{
      const items=Ls.map(x=>({k:x[0],f:x[1],u:x[2]||"",d:x[3]||0,avg:!!x[4]})).filter(M=>{ const v=M.f(Tt); return v!=null && (v!==0 || ["得点","アシスト","出場試合数"].includes(M.k)); });
      if(!items.length) return "";
      return `<div class="pstat"><h3>${esc(g)}</h3><dl>${items.map(M=>{ const v=M.f(Tt), a=M.avg?avgOf(Tt,M):null;
        return `<div><dt>${esc(M.k)}</dt><dd>${fmtV(v,M.d)}<small>${esc(M.u)}</small>${a!=null&&Tt.apps>1?`<em>1試合平均 ${fmtV(a, M.d||1)}</em>`:""}</dd></div>`; }).join("")}</dl></div>`; }).join("") : "";
  return `<section class="pd" data-no="${last&&last.no!=null?last.no:""}"><div class="pd-in">
      <div class="pd-pic">${face(name)}</div>
      <div><div class="pd-pos">${esc(pos)}${pos?` / ${esc({GK:"GOALKEEPER",DF:"DEFENDER",MF:"MIDFIELDER",FW:"FORWARD"}[posGroup(pos)]||"")}`:""}</div>
        ${last&&last.no!=null?`<div class="pd-no">${last.no}</div>`:""}<h1 class="pd-name">${esc(name)}</h1>
        ${prof.length?`<dl class="pd-prof">${prof.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
        ${P&&P.memo?`<p class="pd-memo">${esc(P.memo)}</p>`:""}</div></div></section>
  <div class="wrap" style="max-width:1100px">
    <div class="crumb"><a href="#home">HOME</a> › <a href="#players">PLAYERS</a></div>
    <div class="sub-h" style="margin-top:0">STATS<small>選手スタッツ</small></div>
    ${L.length?`<div class="toolbar"><select class="sel" id="pd-season">${L.slice().reverse().map(r=>`<option value="${esc(r.season)}"${r.season===ps?" selected":""}>${esc(r.season)}シーズン</option>`).join("")}${L.length>1?`<option value=""${ps===""?" selected":""}>通算</option>`:""}</select></div>
      <div class="pstats">${groups}</div>`
      : mg.length? "" : empty("出場選手シートに入れると、Jリーグ公式と同じ項目のスタッツが出ます。")}
    ${L.length>1?`<div class="sub-h">BY SEASON<small>シーズン別</small></div><div class="tw"><table class="t"><thead><tr><th>シーズン</th><th>背番号</th><th>出場</th><th>出場時間</th><th>得点</th><th>アシスト</th><th>シュート</th>${isGK?"<th>失点</th><th>無失点</th>":""}<th>警告</th><th>退場</th></tr></thead>
      <tbody>${L.map(r=>`<tr><th>${esc(r.season)}</th><td class="num">${r.no??""}</td><td class="num">${r.apps}</td><td class="num">${nf(r.min)}</td><td class="num">${r.g}</td><td class="num">${r.a}</td><td class="num">${r["シュート"]??""}</td>${isGK?`<td class="num">${r["失点"]??""}</td><td class="num">${r.cs}</td>`:""}<td class="num">${r.yc}</td><td class="num">${r.rc}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${log.length?`<div class="sub-h">MATCH LOG<small>出場した試合</small></div><div class="tw"><table class="t"><thead><tr><th>日付</th><th class="l">相手</th><th>結果</th><th>出場</th><th>時間</th><th>得点</th><th>アシスト</th><th>シュート</th><th>パス成功率</th>${isGK?"<th>セーブ</th>":""}<th>走行距離</th></tr></thead><tbody>
      ${log.slice().reverse().map(l=>`<tr><td>${fmtMD(l.m.date)}</td><td class="l"><a href="#match/${l.m.id}/lineup"><div class="t-club">${logo(l.m.opp)}${esc(l.m.opp)}</div></a></td><td><span class="res ${resCls(l.m)}" style="font-size:11px">${l.m.gf}-${l.m.ga}</span></td>
        <td>${l.role==="先発"?"先発":l.role==="途中出場"?"途中":"ベンチ"}</td><td class="num">${l.min??""}</td><td class="num">${l.g||""}</td><td class="num">${l.a||""}</td><td class="num">${l.s["シュート"]??""}</td>
        <td class="num">${l.s["パス"]?fmtV(rate(l.s["パス成功"],l.s["パス"]),1)+"%":""}</td>${isGK?`<td class="num">${l.s["セーブ"]??""}</td>`:""}<td class="num">${l.s["走行距離"]!=null?fmtV(l.s["走行距離"],2):""}</td></tr>`).join("")}</tbody></table></div>`
    : mg.length?`<div class="sub-h">HIGHLIGHTS<small>活躍した試合</small></div><div class="mlist">${mg.slice().reverse().map(m=>{ const S=sides(m);
        const g=sum(m.scorers.filter(x=>same(x.name,name)),x=>x.n), a=sum(m.assists.filter(x=>same(x.name,name)),x=>x.n);
        return `<a class="mrow" href="#match/${m.id}"><div class="mrow-d">${dateEN(m.date)}<span>${esc(m.comp)}</span></div>
          <div class="mrow-t r"><span>${esc(S.home)}</span>${logo(S.home)}</div><div class="mrow-s">${S.hs}-${S.as}</div><div class="mrow-t">${logo(S.away)}<span>${esc(S.away)}</span></div>
          <div class="mrow-r" style="font-size:12px;font-weight:700">${[g?`⚽×${g}`:"", a?`A×${a}`:"", same(m.mom,name)?"MOM":""].filter(Boolean).join(" ")}</div></a>`; }).join("")}</div>`:""}
    ${T.length?`<div class="sub-h">TRANSFER<small>移籍の記録</small></div><div class="tr-list">${T.map(trRow).join("")}</div>`:""}</div>`;
}
function bPlayerDetail(){ bindSel("pd-season", v=>{ ST.pSeason=v; render(); }); }

/* ---------- STATS（Jリーグ公式のランキング項目） ---------- */
/* チームの指標：[項目, 計算, 単位, 小数, 1試合平均も] （m=試合の配列、me/op=自分/相手の値の合計） */
function teamTot(L, side, h){ const v=L.map(m=>teamVal(m,side,h)).filter(x=>x!=null); return v.length ? {s:v.reduce((a,b)=>a+b,0), n:v.length} : null; }
function teamMetrics(L){
  const me=h=>teamTot(L,"me",h), op=h=>teamTot(L,"opp",h), r=record(L);
  const out=[];
  const add=(g,k,tot,u,d,avg)=>{ if(tot==null) return; out.push({g,k,v:tot.s!=null?tot.s:tot, n:tot.n, u, d, avg}); };
  const val=(x)=> x ? x : null;
  add("攻撃","得点",{s:r.gf,n:r.n},"点",0,1); add("攻撃","シュート",val(me("シュート")),"本",0,1); add("攻撃","枠内シュート",val(me("枠内シュート")),"本",0,1);
  const sh=me("シュート"); if(sh&&sh.s) out.push({g:"攻撃",k:"シュート決定率",v:r.gf/sh.s*100,u:"%",d:1});
  add("攻撃","ゴール期待値",val(me("ゴール期待値")),"",2,1);
  add("攻撃","流れからのゴール期待値",val(me("流れからのゴール期待値")),"",2,1); add("攻撃","セットプレーからのゴール期待値",val(me("セットプレーからのゴール期待値")),"",2,1);
  const xg=me("ゴール期待値"); if(xg) out.push({g:"攻撃",k:"得点とゴール期待値の差",v:r.gf-xg.s,u:"",d:2});
  add("攻撃","PA内シュート",val(me("PA内シュート")),"本",0,1); add("攻撃","PA外シュート",val(me("PA外シュート")),"本",0,1);
  add("攻撃","ビッグチャンス",val(me("ビッグチャンス")),"回",0,1); add("攻撃","ビッグチャンス逸機",val(me("ビッグチャンス逸機")),"回",0,1);
  add("攻撃","PA内タッチ",val(me("PA内タッチ")),"回",0,1); add("攻撃","チャンスクリエイト",val(me("チャンスクリエイト")),"回",0,1);
  const ps=me("パス"), pc=me("パス成功"); add("パス・ドリブル","パス",val(ps),"本",0,1); if(ps&&pc) out.push({g:"パス・ドリブル",k:"パス成功率",v:pc.s/ps.s*100,u:"%",d:1});
  const dr=me("ドリブル"), dc=me("ドリブル成功"); add("パス・ドリブル","ドリブル",val(dr),"回",0,1); if(dr&&dc) out.push({g:"パス・ドリブル",k:"ドリブル成功率",v:dc.s/dr.s*100,u:"%",d:1});
  const tp=me("スルーパス"), tc=me("スルーパス成功"); add("パス・ドリブル","スルーパス",val(tp),"本",0,1); if(tp&&tc) out.push({g:"パス・ドリブル",k:"スルーパス成功率",v:tc.s/tp.s*100,u:"%",d:1});
  add("パス・ドリブル","クロス",val(me("クロス")),"本",0,1);
  const lp=me("ロングパス"), lc=me("ロングパス成功"); add("パス・ドリブル","ロングパス",val(lp),"本",0,1); if(lp&&lc) out.push({g:"パス・ドリブル",k:"ロングパス成功率",v:lc.s/lp.s*100,u:"%",d:1});
  const po=me("ボール支配率"); if(po) out.push({g:"パス・ドリブル",k:"平均ボール支配率",v:po.s/po.n,u:"%",d:1});
  add("守備","失点",{s:r.ga,n:r.n},"点",0,1); add("守備","被シュート",val(op("シュート")),"本",0,1); add("守備","被枠内シュート",val(op("枠内シュート")),"本",0,1);
  add("守備","被ゴール期待値",val(op("ゴール期待値")),"",2,1); add("守備","被ビッグチャンス",val(op("ビッグチャンス")),"回",0,1); out.push({g:"守備",k:"クリーンシート",v:r.cs,u:"試合"});
  add("守備","クリア",val(me("クリア")),"回",0,1); const tk=me("タックル"), tw=me("タックル成功"); add("守備","タックル",val(tk),"回",0,1); if(tk&&tw) out.push({g:"守備",k:"タックル成功率",v:tw.s/tk.s*100,u:"%",d:1});
  add("守備","ブロック",val(me("ブロック")),"回",0,1); add("守備","インターセプト",val(me("インターセプト")),"回",0,1);
  const ae=me("空中戦"), aw=me("空中戦勝利"); add("守備","空中戦勝利",val(aw),"回",0,1); if(ae&&aw) out.push({g:"守備",k:"空中戦勝率",v:aw.s/ae.s*100,u:"%",d:1});
  add("守備","1vs1勝利",val(me("1vs1勝利")),"回",0,1); add("守備","こぼれ球奪取",val(me("こぼれ球奪取")),"回",0,1); add("守備","デュエル勝利",val(me("デュエル勝利")),"回",0,1); add("守備","セーブ",val(me("セーブ")),"回",0,1);
  add("守備","シュートにつながるミス",val(me("シュートにつながるミス")),"回",0,1); add("守備","失点につながるミス",val(me("失点につながるミス")),"回",0,1);
  add("規律","ファウル",val(me("ファウル")),"回",0,1); add("規律","警告",val(me("警告")),"枚"); add("規律","退場",val(me("退場")),"回");
  ["走行距離","スプリント","Atスプリント","Mtスプリント","Dtスプリント","ポゼッション時走行距離","ポゼッション時スプリント","被ポゼッション時走行距離","被ポゼッション時スプリント"].forEach(h=>{
    const t=me(h); if(t) out.push({g:"フィジカル",k:`1試合平均${h}`,v:t.s/t.n,u:/距離/.test(h)?"km":"回",d:/距離/.test(h)?1:0}); });
  return out;
}
function vStats(){
  const s=ST.stSeason;
  const rows=statRowsFor(s);
  const fm=fromMatches(s); const mm={}; fm.forEach(x=>mm[nameKey(x.name)]=x.mom);
  rows.forEach(r=>{ if(r.mom==null) r.mom=mm[nameKey(r.name)]||0; });
  const avail=PM_ALL.filter(M=>rows.some(r=>{ const v=M.f(r); return v!=null && v!==0; }));
  if(!avail.find(M=>M.k===ST.rk)) ST.rk=(avail.find(M=>M.k==="得点")||avail[0]||{k:"得点"}).k;
  const M=PM_ALL.find(x=>x.k===ST.rk) || PM_ALL.find(x=>x.k==="得点");
  let R=rows.map(r=>({r, v:M.f(r)})).filter(x=>x.v!=null && x.v!==0);
  if(M.base){ const mx=Math.max(0,...rows.map(r=>M.base(r)||0)); const need=Math.max(1, Math.round(mx*0.3)); R=R.filter(x=>(M.base(x.r)||0)>=need); }
  if(M.k==="トップスピード") R=R.filter(x=>x.v>0);
  R.sort((a,b)=>b.v-a.v); R=R.slice(0,20);
  const L=ofSeason(s||null), TM=teamMetrics(L), tg={}; TM.forEach(x=>(tg[x.g]=tg[x.g]||[]).push(x));
  const quick=["得点","アシスト","出場時間","シュート","チャンスクリエイト","デュエル勝利","走行距離"].filter(k=>avail.some(a=>a.k===k));
  return `${band("STATS","記録・ランキング")}<div class="wrap" style="max-width:1000px">
    <div class="toolbar">${seasonSel("st-season", s, true)}</div>
    <div class="sub-h" style="margin-top:0">PLAYERS<small>選手ランキング</small></div>
    ${avail.length?`<div class="pill-tabs" id="st-quick">${quick.map(k=>`<button class="pill${k===M.k?" on":""}" data-k="${esc(k)}">${esc(k)}</button>`).join("")}</div>
      <div class="toolbar"><select class="sel" id="st-item" aria-label="項目を選ぶ">${PM.map(([g,Ls])=>{ const o=Ls.filter(x=>avail.some(a=>a.k===x[0])); return o.length?`<optgroup label="${esc(g)}">${o.map(x=>`<option${x[0]===M.k?" selected":""}>${esc(x[0])}</option>`).join("")}</optgroup>`:""; }).join("")}</select></div>
      <div class="rk">${R.map((x,i)=>`<a class="rk-r" href="#player/${encodeURIComponent(x.r.name)}"><div class="rk-n">${i+1}</div>${face(x.r.name)}
        <div><b>${esc(x.r.name)}</b><small>${esc((profile(x.r.name)||{}).pos||x.r.pos||"")}${x.r.apps?`・${x.r.apps}試合`:""}</small></div>
        <div class="rk-v">${fmtV(x.v,M.d)}<small>${esc(M.u)}</small></div></a>`).join("")||empty("該当する選手がいません。")}</div>
      <p class="note">${M.base?"※ 試行数が少ない選手は除いています。":""}${rows.some(r=>r._n)?"出場選手シートから集計":"試合シートの得点者・アシスト・MOMから集計"}</p>`
      : empty("出場選手シートか、試合シートの得点者を入れると、ランキングが出ます。")}
    ${L.length?`<div class="sub-h">TEAM<small>チームスタッツ</small></div>
      <div class="chips"><div class="chip"><span>試合</span><b>${L.length}</b></div><div class="chip"><span>勝-分-敗</span><b>${record(L).w}<small>勝</small>${record(L).d}<small>分</small>${record(L).l}<small>敗</small></b></div></div>
      ${Object.keys(tg).map(g=>`<div class="tw" style="margin-bottom:14px"><table class="t"><thead><tr><th class="l">${esc(g)}</th><th>合計</th><th>1試合平均</th></tr></thead><tbody>
        ${tg[g].map(x=>`<tr><th class="l">${esc(x.k)}</th><td class="num">${fmtV(x.v,x.d)}<small> ${esc(x.u)}</small></td><td class="num">${x.avg&&x.n?fmtV(x.v/x.n, Math.max(1,x.d)):""}</td></tr>`).join("")}</tbody></table></div>`).join("")}`:""}</div>`;
}
function bStats(){ bindSel("st-season", v=>{ ST.stSeason=v; render(); }); bindSel("st-item", v=>{ ST.rk=v; render(); });
  document.querySelectorAll("#st-quick .pill").forEach(b=>b.onclick=()=>{ ST.rk=b.dataset.k; render(); }); }

/* ---------- TRANSFER ---------- */
function trRow(t){
  const dir=trDir(t.kind);
  return `<div class="tr">${face(t.name)}
    <div style="min-width:0"><span class="tr-k ${dir}">${esc(t.kind)}</span><a href="#player/${encodeURIComponent(t.name)}"><b>${esc(t.name)}</b></a>
      <div class="tr-c">${t.club?`${dir==="out"?"→":"←"} ${logo(t.club)}<span>${esc(t.club)}</span>`:""}<span class="en" style="color:var(--ink3);font-weight:600">${fmtD(t.date)}</span></div>
      ${t.memo?`<div class="tr-c">${esc(t.memo)}</div>`:""}</div>
    <div class="tr-f">${t.fee?money(t.fee):""}<small>${esc(t.season)}</small></div></div>`;
}
function vTransfer(){
  const s=ST.trSeason;
  const T=D.trans.filter(t=>!s||t.season===s).sort((a,b)=>(b.date?b.date:0)-(a.date?a.date:0));
  const In=T.filter(t=>trDir(t.kind)==="in"), Out=T.filter(t=>trDir(t.kind)==="out"), Etc=T.filter(t=>trDir(t.kind)==="etc");
  const spend=sum(In,t=>t.fee), earn=sum(Out,t=>t.fee), net=earn-spend;
  const top=D.trans.filter(t=>t.fee).sort((a,b)=>b.fee-a.fee).slice(0,5);
  return `${band("TRANSFER","移籍情報")}<div class="wrap narrow">
    <div class="toolbar">${seasonSel("tr-season", s, true)}</div>
    ${T.length?`<div class="chips"><div class="chip"><span>支出</span><b>${nf(spend)}</b><span>${esc(unit())}</span></div><div class="chip"><span>収入</span><b>${nf(earn)}</b><span>${esc(unit())}</span></div>
      <div class="chip"><span>収支</span><b style="color:${net>=0?"var(--win)":"var(--lose)"}">${net>0?"+":net<0?"−":""}${nf(Math.abs(net))}</b><span>${esc(unit())}</span></div></div>`:""}
    <div class="sub-h" style="margin-top:0">IN<small>加入 ${In.length?`${In.length}人`:""}</small></div>${In.length?`<div class="tr-list">${In.map(trRow).join("")}</div>`:empty("加入はまだありません。")}
    <div class="sub-h">OUT<small>退団 ${Out.length?`${Out.length}人`:""}</small></div>${Out.length?`<div class="tr-list">${Out.map(trRow).join("")}</div>`:empty("退団はまだありません。")}
    ${Etc.length?`<div class="sub-h">CONTRACT<small>契約更新など</small></div><div class="tr-list">${Etc.map(trRow).join("")}</div>`:""}
    ${!s&&top.length?`<div class="sub-h">RECORD<small>歴代の高額移籍</small></div><div class="tr-list">${top.map(trRow).join("")}</div>`:""}</div>`;
}
function bTransfer(){ bindSel("tr-season", v=>{ ST.trSeason=v; render(); }); }

/* ---------- CLUB（歴史・順位表） ---------- */
function standing(season, comp, mini){
  const seasons=[...new Set(D.table.map(r=>r.season))].sort().reverse();
  const ts= season && seasons.includes(season) ? season : seasons[0];
  if(!ts) return "";
  const comps=[...new Set(D.table.filter(r=>r.season===ts).map(r=>r.comp))];
  const tc= comps.includes(comp) ? comp : comps[0];
  let tb=D.table.filter(r=>r.season===ts && r.comp===tc).sort((a,b)=>(a.rank||99)-(b.rank||99));
  if(mini){ const i=tb.findIndex(r=>isMe(r.club)); const a=Math.max(0, Math.min((i<0?0:i)-2, tb.length-5)); tb=tb.slice(a, a+5); }
  return `${mini?`<p style="font-size:12px;color:var(--ink2);margin:-8px 0 10px;font-weight:700">${esc(ts)} ${esc(tc)}</p>`:""}
    <div class="tw"><table class="t"><thead><tr><th>順位</th><th class="l">クラブ</th><th>試合</th><th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th><th>得失点</th><th>勝点</th></tr></thead><tbody>
    ${tb.map(r=>{ const me=isMe(r.club), nm=me?clubName():r.club; return `<tr class="${me?"me":""}"><th class="num">${r.rank??""}</th><td class="l"><div class="t-club">${logo(nm)}${esc(nm)}</div></td>
      <td class="num">${r.p??""}</td><td class="num">${r.w??""}</td><td class="num">${r.d??""}</td><td class="num">${r.l??""}</td><td class="num">${r.gf??""}</td><td class="num">${r.ga??""}</td>
      <td class="num">${r.gf!=null&&r.ga!=null?(r.gf-r.ga>0?"+":"")+(r.gf-r.ga):""}</td><td class="num"><b>${r.pts??""}</b></td></tr>`; }).join("")}</tbody></table></div>`;
}
function vHistory(){
  const titles=[]; D.seasons.forEach(S=>{ if(/^1$/.test(S.rank)) titles.push([S.league||"リーグ",S.season]);
    [["国内カップ",S.cup],["リーグカップ",S.lcup],["国際大会",S.intl]].forEach(([k,v])=>{ if(/^優勝/.test(v||"")) titles.push([k,S.season]); }); });
  const tc={}; titles.forEach(([k,s])=>(tc[k]=tc[k]||[]).push(s));
  const seasons=[...D.seasonList].sort();
  const tSeasons=[...new Set(D.table.map(r=>r.season))].sort().reverse();
  const ts=ST.tblSeason && tSeasons.includes(ST.tblSeason) ? ST.tblSeason : tSeasons[0];
  const comps=[...new Set(D.table.filter(r=>r.season===ts).map(r=>r.comp))];
  const info=[["クラブ名",clubName()],["ホームスタジアム",D.conf["ホームスタジアム"]],["監督",D.conf["監督名"]],["最初のシーズン",D.conf["最初のシーズン"]]].filter(([,v])=>v);
  return `${band("CLUB","クラブ情報・歴史")}<div class="wrap" style="max-width:1000px">
    ${info.length?`<dl class="club-info">${info.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
    <div class="sub-h">TITLES<small>獲得タイトル</small></div>
    ${Object.keys(tc).length?`<div class="ti-grid">${Object.keys(tc).map(k=>`<div class="ti"><b>${tc[k].length}<small>回</small></b><div>${esc(k)}</div><p>${esc(tc[k].join("、"))}</p></div>`).join("")}</div>`:empty("まだタイトルはありません。")}
    <div class="sub-h">HISTORY<small>歴代成績</small></div>
    ${seasons.length?`<div class="tw"><table class="t"><thead><tr><th>シーズン</th><th class="l">リーグ</th><th>順位</th><th>勝-分-敗</th><th>得失点</th><th>国内カップ</th><th>リーグカップ</th><th>国際大会</th><th class="l">主将</th></tr></thead><tbody>
      ${seasons.map(s=>{ const S=seasonInfo(s)||{}, r=record(ofSeason(s)), rk=myRank(s);
        return `<tr><th>${esc(s)}</th><td class="l">${esc(S.league||leagueName(s))}</td><td class="num${rk==="1"?" gold":""}">${esc(rk)}</td><td>${r.n?`${r.w}-${r.d}-${r.l}`:""}</td><td>${r.n?`${r.gf}-${r.ga}`:""}</td>
          <td${/^優勝/.test(S.cup||"")?' class="gold"':""}>${esc(S.cup||"")}</td><td${/^優勝/.test(S.lcup||"")?' class="gold"':""}>${esc(S.lcup||"")}</td><td${/^優勝/.test(S.intl||"")?' class="gold"':""}>${esc(S.intl||"")}</td>
          <td class="l">${S.cap?`<a href="#player/${encodeURIComponent(S.cap)}">${esc(S.cap)}</a>`:""}</td></tr>`; }).join("")}</tbody></table></div>`:empty("まだシーズンの記録がありません。")}
    ${D.seasons.filter(S=>S.comment).length?`<div style="margin-top:16px;display:grid;gap:10px">${D.seasons.filter(S=>S.comment).slice().reverse().map(S=>`<div class="memo" style="margin:0"><b class="en" style="font-size:16px">${esc(S.season)}</b><br>${esc(S.comment)}</div>`).join("")}</div>`:""}
    <div class="sub-h">STANDINGS<small>順位表</small></div>
    ${ts?`<div class="toolbar"><select class="sel" id="hs-season">${tSeasons.map(s=>`<option${s===ts?" selected":""}>${esc(s)}</option>`).join("")}</select>
      ${comps.length>1?`<select class="sel" id="hs-comp">${comps.map(c=>`<option${c===ST.tblComp?" selected":""}>${esc(c)}</option>`).join("")}</select>`:""}</div>${standing(ts, ST.tblComp)}`
      : empty("順位表シートに入れると、ここに最終順位表が出ます。")}</div>`;
}
function bHistory(){ bindSel("hs-season", v=>{ ST.tblSeason=v; ST.tblComp=null; render(); }); bindSel("hs-comp", v=>{ ST.tblComp=v; render(); }); }

/* =====================================================================
   ルーティング・メニュー
   ===================================================================== */
const ROUTES = {
  home:     [vHome, bHome, "HOME"],
  news:     [vNews, bNews, "NEWS", vNewsDetail],
  match:    [vMatch, bMatch, "MATCH", vMatchDetail, bMatchDetail],
  players:  [vPlayers, bPlayers, "PLAYERS"],
  player:   [null, null, "PLAYERS", vPlayerDetail, bPlayerDetail],
  stats:    [vStats, bStats, "STATS"],
  transfer: [vTransfer, bTransfer, "TRANSFER"],
  history:  [vHistory, bHistory, "CLUB"]
};
function parseHash(){ const h=decodeURIComponent((location.hash||"").replace(/^#/,"")); const i=h.indexOf("/"); return i<0 ? {page:h||"home", arg:null} : {page:h.slice(0,i), arg:h.slice(i+1)}; }
let lastKey="";
function render(){
  let {page,arg}=parseHash(); if(!ROUTES[page]) { page="home"; arg=null; }
  const R=ROUTES[page];
  const nav = page==="player" ? "players" : page;
  document.querySelectorAll(".hd-nav a, .drawer-nav a").forEach(a=>a.classList.toggle("on", (a.dataset.nav||a.getAttribute("href").slice(1))===nav));
  const view=$("view");
  if(!D.loaded){ view.innerHTML=`<div class="wrap"><div class="loading">読み込み中…</div></div>`; return; }
  if(D.err){ view.innerHTML=`<div class="wrap">${empty(D.err)}</div>`; return; }
  const detail = arg!=null && R[3];
  const key=page+"/"+(arg||"").split("/")[0];
  if(page==="match" && detail && key!==lastKey && !String(arg).includes("/")) ST.mtab="sum";
  view.innerHTML = detail ? R[3](arg) : (R[0]?R[0]():"");
  if(detail && R[4]) R[4](); else if(!detail && R[1]) R[1]();
  let title=R[2];
  if(detail){ const h=view.querySelector(".nd-head h1,.pd-name,.mh-comp"); if(h) title=h.textContent.trim(); }
  document.title = page==="home" ? `${clubName()} オフィシャルサイト` : `${title} | ${clubName()}`;
  if(key!==lastKey){ toTop(); lastKey=key; }
}
/* ページの一番上へ。iPhoneのSafariは描き替え直後の命令を無視することがあるので、描画のあとにもう一度戻す */
function toTop(){
  const go=()=>{ window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0; };
  go(); requestAnimationFrame(go); setTimeout(go,60); setTimeout(go,250);
}
if("scrollRestoration" in history) history.scrollRestoration="manual";
function setMenu(open){
  const btn=$("menu-btn"), dr=$("drawer");
  btn.setAttribute("aria-expanded", open?"true":"false"); btn.setAttribute("aria-label", open?"メニューを閉じる":"メニューを開く");
  dr.hidden=!open; document.body.classList.toggle("lock", open);
}
$("menu-btn").onclick=()=>setMenu($("drawer").hidden);
$("drawer-sns").innerHTML=$("ft-sns").innerHTML;
document.addEventListener("keydown", e=>{ if(e.key==="Escape") setMenu(false); });
matchMedia("(min-width:961px)").addEventListener("change", e=>{ if(e.matches) setMenu(false); });
window.addEventListener("hashchange", ()=>{ setMenu(false); render(); });
$("ft-year").textContent=new Date().getFullYear();
render();
loadAll().catch(e=>{ console.error(e); D.err="読み込み中にエラーが起きました。"; D.loaded=true; }).finally(render);
