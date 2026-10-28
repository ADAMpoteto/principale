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
  stats:  ["選手成績",     101],
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
const face = (name, cls) => imgTag(imgCands("player",[fullName(name)]), fullName(name), "face "+(cls||""), "p:"+nameKey(fullName(name)));
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
const ST = { season:null, stSeason:"", trSeason:"", comp:"すべて", newsCat:"すべて", rk:"g", tblSeason:null, tblComp:null, mtab:"sum", luSide:"me" };

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

async function loadAll(){
  const keys=Object.keys(SHEETS);
  const res=await Promise.allSettled(keys.map(k=>fetchCSV(sheetUrl(k))));
  const got={}; let fails=0;
  keys.forEach((k,i)=>{ if(res[i].status==="fulfilled") got[k]=res[i].value; else { got[k]=[]; fails++; console.error(SHEETS[k][0], res[i].reason); } });
  if(fails===keys.length) D.err="スプレッドシートを読み込めませんでした。スプシを「リンクを知っている全員（閲覧者）」に共有するか、「ウェブに公開」して app.js の PUB_URL にURLを入れてください。";

  got.conf.forEach(o=>{ const k=F(o,"項目"), v=F(o,"値"); if(k) D.conf[k]=v; });
  D.players=got.player.map(o=>({ name:F(o,"名前"), pos:F(o,"ポジション").toUpperCase(), nat:F(o,"国籍"), birth:pDate(F(o,"生年月日")), birthS:F(o,"生年月日"),
    foot:F(o,"利き足"), height:num(F(o,"身長")), pot:num(F(o,"ポテンシャル")), memo:F(o,"メモ") })).filter(p=>p.name);
  D.stats=got.stats.map(o=>({ season:F(o,"シーズン"), name:F(o,"名前"), no:num(F(o,"背番号")), pos:F(o,"ポジション").toUpperCase(), ovr:num(F(o,"総合値")),
    apps:num(F(o,"出場")), g:num(F(o,"得点")), a:num(F(o,"アシスト")), rating:num(F(o,"平均評価")), cs:num(F(o,"クリーンシート")),
    yc:num(F(o,"警告")), rc:num(F(o,"退場")) })).filter(r=>r.name && r.season);
  /* 出場選手（名前合わせに使うので先に） */
  D.lineups=got.lineup.map((o,i)=>{ const side=sideOf(F(o,"チーム")); const raw=F(o,"名前");
    return { i, key:dKey(pDate(F(o,"日付"))), side, role:F(o,"出場")||"先発", no:num(F(o,"背番号")), rawName:raw, pos:F(o,"ポジション").toUpperCase(),
      min:num(F(o,"出場時間")), rating:num(F(o,"評価")), g:num(F(o,"得点")), a:num(F(o,"アシスト")), sh:num(F(o,"シュート")),
      pass:pct(F(o,"パス成功率")), tk:num(F(o,"タックル")), sv:num(F(o,"セーブ")), yc:num(F(o,"警告")), rc:num(F(o,"退場")) }; }).filter(l=>l.rawName && l.key);
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
      draw: played && gf===ga, scorers:parseNames(F(o,"得点者")), assists:parseNames(F(o,"アシスト")), mom:fullName(F(o,"MOM")), momAuto:false,
      att:num(F(o,"観客数")), memo:F(o,"メモ"), video:F(o,"動画"), ts:{}, lu:{me:[],opp:[]}, ev:[] };
  }).filter(Boolean);
  D.matches.sort((a,b)=>(a.date&&b.date? a.date-b.date : 0) || a.i-b.i);
  D.matches.forEach((m,k)=>m.id=k+1);
  const byKey={}; D.matches.forEach(m=>{ if(m.key && !byKey[m.key]) byKey[m.key]=m; });

  /* チームスタッツ */
  got.tstats.forEach(o=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return;
    m.ts[sideOf(F(o,"チーム"))] = { form:parseForm(F(o,"フォーメーション")), poss:pct(F(o,"ポゼッション")), sh:num(F(o,"シュート")), sot:num(F(o,"枠内シュート")),
      xg:num(F(o,"xG")), pass:num(F(o,"パス")), passp:pct(F(o,"パス成功率")), tk:num(F(o,"タックル")), int:num(F(o,"インターセプト")),
      foul:num(F(o,"ファウル")), off:num(F(o,"オフサイド")), ck:num(F(o,"コーナーキック")), sv:num(F(o,"セーブ")), yc:num(F(o,"警告")), rc:num(F(o,"退場")) }; });
  /* 出場選手を試合につなぐ */
  D.lineups.forEach(l=>{ const m=byKey[l.key]; if(m){ l.m=m; m.lu[l.side].push(l); } });
  /* 試合経過 */
  got.events.forEach((o,i)=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return; const side=sideOf(F(o,"チーム"));
    const nm = s => side==="me" ? fullName(s) : s;
    m.ev.push({ i, min:half(F(o,"分")), mn:minN(F(o,"分")), side, kind:F(o,"種類")||"その他", player:nm(F(o,"選手")), rel:nm(F(o,"関連する選手")), note:F(o,"補足") }); });
  D.matches.forEach(m=>{
    m.ev.sort((a,b)=>a.mn-b.mn || a.i-b.i);
    if(!m.played) return;
    /* 得点者・アシストが空欄なら、出場選手 → 試合経過 の順で補う */
    if(!m.scorers.length){
      const L=m.lu.me.filter(l=>l.g); if(L.length) m.scorers=L.map(l=>({name:l.name,n:l.g}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&/^(ゴール|PKゴール)$/.test(e.kind)&&e.player).forEach(e=>c[e.player]=(c[e.player]||0)+1); m.scorers=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
    if(!m.assists.length){
      const L=m.lu.me.filter(l=>l.a); if(L.length) m.assists=L.map(l=>({name:l.name,n:l.a}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&/ゴール/.test(e.kind)&&e.kind!=="オウンゴール"&&e.rel).forEach(e=>c[e.rel]=(c[e.rel]||0)+1); m.assists=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
    /* MOM が空欄なら、評価がいちばん高い自分の選手 */
    if(!m.mom){ const best=m.lu.me.filter(l=>l.rating!=null).sort((a,b)=>b.rating-a.rating)[0]; if(best){ m.mom=best.name; m.momAuto=true; } }
  });
  D.played=D.matches.filter(m=>m.played);

  D.trans=got.trans.map((o,i)=>({ i, season:F(o,"シーズン"), date:pDate(F(o,"日付")), kind:F(o,"区分")||"加入", name:fullName(F(o,"名前")),
    club:F(o,"相手クラブ"), fee:num(F(o,"移籍金")), memo:F(o,"メモ") })).filter(t=>t.name);
  D.seasons=got.season.map(o=>({ season:F(o,"シーズン"), league:F(o,"リーグ"), rank:half(F(o,"リーグ順位")).replace(/位$/,""), cup:F(o,"国内カップ"),
    lcup:F(o,"リーグカップ"), intl:F(o,"国際大会"), cap:fullName(F(o,"主将")), comment:F(o,"一言") })).filter(s=>s.season);
  D.table=got.table.map(o=>({ season:F(o,"シーズン"), comp:F(o,"大会"), rank:num(F(o,"順位")), club:F(o,"クラブ"), p:num(F(o,"試合")),
    w:num(F(o,"勝")), d:num(F(o,"分")), l:num(F(o,"負")), gf:num(F(o,"得点")), ga:num(F(o,"失点")), pts:num(F(o,"勝点")) })).filter(r=>r.club);

  const ss=new Set([...D.matches,...D.stats,...D.trans,...D.seasons,...D.table].map(x=>x.season).filter(Boolean));
  if(D.conf["最初のシーズン"] && !ss.size) ss.add(D.conf["最初のシーズン"]);
  D.seasonList=[...ss].sort().reverse();
  const lastPlayed=D.played[D.played.length-1];
  ST.season = (lastPlayed && lastPlayed.season) || D.seasonList[0] || null;
  ST.stSeason = ST.trSeason = ST.season || "";
  buildNews();
  D.loaded=true;
  ["hd-name","ft-club","ft-name"].forEach(id=>$(id).textContent=clubName());
}

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
function fromMatches(s){
  const M={}; const add=(n,k,v)=>{ if(!n) return; (M[n]=M[n]||{name:n,g:0,a:0,mom:0})[k]+=v; };
  ofSeason(s).forEach(m=>{ m.scorers.forEach(x=>add(x.name,"g",x.n)); m.assists.forEach(x=>add(x.name,"a",x.n)); if(m.mom) add(m.mom,"mom",1); });
  return Object.values(M);
}
/* 出場選手シートから、選手のシーズン成績を作る */
function luAgg(s){
  const M={};
  D.lineups.filter(l=>l.side==="me" && l.m && l.m.played && (!s || l.m.season===s) && (l.role!=="ベンチ" || l.min)).forEach(l=>{
    const o=M[nameKey(l.name)]=M[nameKey(l.name)]||{name:l.name,season:s,apps:0,starts:0,min:0,g:0,a:0,yc:0,rc:0,cs:0,sv:0,_r:0,_rn:0,pos:"",no:null,mom:0};
    o.apps++; if(l.role==="先発") o.starts++; o.min+=l.min||0; o.g+=l.g||0; o.a+=l.a||0; o.yc+=l.yc||0; o.rc+=l.rc||0; o.sv+=l.sv||0;
    if(l.rating!=null){ o._r+=l.rating; o._rn++; } if(l.pos) o.pos=l.pos; if(l.no!=null) o.no=l.no;
    if(l.pos==="GK" && l.role==="先発" && l.m.ga===0) o.cs++;
  });
  return Object.values(M).map(o=>({...o, rating:o._rn? o._r/o._rn : null, fromLu:true}));
}
function seasonRows(s){   /* そのシーズンの選手成績：選手成績シート → 出場選手シート の順 */
  const sh=D.stats.filter(r=>r.season===s);
  return sh.length ? sh : luAgg(s);
}
function statRowsFor(s){
  if(s) return seasonRows(s);
  const M={};
  D.seasonList.forEach(se=>seasonRows(se).forEach(r=>{ const k=nameKey(r.name);
    const o=M[k]=M[k]||{name:r.name,apps:0,g:0,a:0,cs:0,yc:0,rc:0,_rs:0,_ra:0,pos:""};
    o.apps+=r.apps||0; o.g+=r.g||0; o.a+=r.a||0; o.cs+=r.cs||0; o.yc+=r.yc||0; o.rc+=r.rc||0; o.pos=r.pos||o.pos;
    if(r.rating!=null && r.apps){ o._rs+=r.rating*r.apps; o._ra+=r.apps; } }));
  return Object.values(M).map(o=>({...o, rating:o._ra? o._rs/o._ra : null}));
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
const rtCls = v => v>=9?"r9":v>=8?"r8":v>=7?"r7":v>=6?"r6":"r5";
const rt = v => v==null ? "" : `<span class="rt ${rtCls(v)}">${(+v).toFixed(1)}</span>`;

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
    const me=m.ts.me, op=m.ts.opp;
    if(me && op && me.poss!=null) P.push(`<p>ボール支配率は${me.poss}%対${op.poss}%${me.sh!=null&&op.sh!=null?`、シュートは${me.sh}本対${op.sh}本`:""}でした。</p>`);
    if(m.mom) P.push(`<p>マン・オブ・ザ・マッチには${pLink(m.mom)}${(()=>{ const l=m.lu.me.find(x=>same(x.name,m.mom)); return l&&l.rating!=null?`（評価 ${l.rating.toFixed(1)}）`:""; })()}が選ばれました。</p>`);
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
    <div class="mlinks">${m.played?`<a href="#match/${m.id}">試合詳細</a>${hasStats(m)?`<a href="#match/${m.id}/stats">スタッツ</a>`:""}${m.lu.me.length?`<a href="#match/${m.id}/lineup">スタメン</a>`:""}${m.video?`<a href="${esc(m.video)}" target="_blank" rel="noopener">動画</a>`:""}`
      :`<a href="#match">試合日程</a><a href="#match/${m.id}">対戦情報</a>`}</div></div>`;
}
const hasStats = m => !!(m.ts.me || m.ts.opp);

/* ---------- HOME ---------- */
let sliderTimer=null;
function vHome(){
  const s=ST.season, r=record(ofSeason(s)), rk=myRank(s), lg=leagueName(s);
  const next=D.matches.find(m=>!m.played), last=D.played.slice(-2).reverse();
  const boxes=[]; if(next) boxes.push(matchBox(next,"NEXT MATCH")); if(last[0]) boxes.push(matchBox(last[0],"LATEST RESULT")); if(!next && last[1]) boxes.push(matchBox(last[1],"PREVIOUS RESULT"));
  const slides=D.news.slice(0,5);
  const leaders=[["TOP SCORER","g","点"],["TOP ASSIST","a",""],["BEST RATING","rating",""]].map(([l,k,u])=>{
    let rows=statRowsFor(s).filter(x=>x[k]); if(!rows.length && k!=="rating") rows=fromMatches(s).filter(x=>x[k]);
    if(k==="rating") rows=rows.filter(x=>(x.apps||0)>=3);
    rows.sort((a,b)=>b[k]-a[k]); const t=rows[0]; if(!t) return "";
    return `<a class="leader" href="#player/${encodeURIComponent(t.name)}">${face(t.name)}<div><span>${l}</span><b>${esc(t.name)}</b><em>${k==="rating"?t[k].toFixed(2):t[k]}<small>${u}</small></em></div></a>`;
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
  const go=i=>box.scrollTo({left:i*box.clientWidth});
  btns.forEach((b,i)=>b.onclick=e=>{ e.preventDefault(); go(i); restart(); });
  box.addEventListener("scroll",()=>{ const i=Math.round(box.scrollLeft/box.clientWidth); btns.forEach((b,k)=>b.classList.toggle("on",k===i)); },{passive:true});
  const restart=()=>{ clearInterval(sliderTimer); if(btns.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    sliderTimer=setInterval(()=>{ if(!document.body.contains(box)){ clearInterval(sliderTimer); return; } const i=Math.round(box.scrollLeft/box.clientWidth); go((i+1)%btns.length); },6000); };
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

const STAT_ITEMS = [["poss","ボール支配率","%"],["sh","シュート",""],["sot","枠内シュート",""],["xg","ゴール期待値（xG）",""],["pass","パス",""],["passp","パス成功率","%"],
  ["tk","タックル",""],["int","インターセプト",""],["foul","ファウル",""],["off","オフサイド",""],["ck","コーナーキック",""],["sv","セーブ",""],["yc","警告",""],["rc","退場",""]];
const LOW_BETTER = {foul:1,off:1,yc:1,rc:1};
function ytId(u){ const m=String(u||"").match(/(?:youtu\.be\/|v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/); return m?m[1]:null; }

function vMatchDetail(arg){
  const [id, tab]=String(arg).split("/");
  const m=D.matches.find(x=>x.id===+id); if(!m) return `${band("MATCH","試合")}<div class="wrap">${empty("試合が見つかりません。")}</div>`;
  if(tab) ST.mtab=tab;
  const S=sides(m), hasLu=m.lu.me.length||m.lu.opp.length, hasEv=m.ev.length;
  const T=[["sum","SUMMARY","概要",true],["stats","STATS","スタッツ",hasStats(m)],["lineup","LINE-UP","スタメン",hasLu],["timeline","TIMELINE","経過",hasEv]];
  if(!T.find(t=>t[0]===ST.mtab && t[3])) ST.mtab="sum";
  const goalsOf = side => side==="me" ? m.scorers.map(x=>`${esc(x.name)}${x.n>1?` ×${x.n}`:""}`)
    : m.ev.filter(e=>e.side==="opp"&&/ゴール/.test(e.kind)&&e.kind!=="オウンゴール").map(e=>`${esc(e.player)} ${esc(e.min)}'`)
      .concat(m.lu.opp.filter(l=>l.g&&!m.ev.some(e=>e.side==="opp"&&/ゴール/.test(e.kind))).map(l=>`${esc(l.name)}${l.g>1?` ×${l.g}`:""}`));
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
  document.querySelectorAll("#lu-side .pill").forEach(b=>b.onclick=()=>{ ST.luSide=b.dataset.s; render(); }); }

function tabSummary(m){
  const v=ytId(m.video);
  const mom=m.mom ? m.lu.me.find(l=>same(l.name,m.mom)) : null;
  const list=(L)=> L.length? `<ul>${L.map(x=>`<li><a href="#player/${encodeURIComponent(x.name)}">${esc(x.name)}</a>${x.n>1?` ×${x.n}`:""}</li>`).join("")}</ul>` : `<p style="color:var(--ink3);font-size:13px">なし</p>`;
  return `<div class="box-grid">
      <div class="box"><h3>GOAL<small>得点者</small></h3>${list(m.scorers)}</div>
      <div class="box"><h3>ASSIST<small>アシスト</small></h3>${list(m.assists)}</div>
      ${m.mom?`<a class="box mom" href="#player/${encodeURIComponent(m.mom)}">${face(m.mom)}<div><h3 style="margin-bottom:2px">MAN OF THE MATCH${m.momAuto?"<small>（評価から自動）</small>":""}</h3><b>${esc(m.mom)}</b>${mom&&mom.rating!=null?rt(mom.rating):""}</div></a>`:""}
      ${m.att?`<div class="box"><h3>ATTENDANCE<small>観客数</small></h3><b class="en" style="font-size:36px;font-weight:800">${nf(m.att)}</b> 人</div>`:""}
    </div>
    ${m.memo?`<div class="memo">${esc(m.memo)}</div>`:""}
    ${v?`<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${v}" title="試合の動画" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      : m.video?`<p style="margin-top:16px"><a class="btn" href="${esc(m.video)}" target="_blank" rel="noopener">VIDEO ›</a></p>`:""}
    ${hasStats(m)?`<div style="margin-top:28px">${tabStats(m, sides(m), 4)}</div>`:""}`;
}
function tabStats(m,S,limit){
  const H=m.ts[S.hSide]||{}, A=m.ts[S.aSide]||{};
  const items=STAT_ITEMS.filter(([k])=>H[k]!=null||A[k]!=null).slice(0, limit||99);
  if(!items.length) return empty("チームスタッツシートに入れると、ここに比較が出ます。");
  const fmt=(k,v,u)=> v==null?"-": (k==="xg"? (+v).toFixed(1) : v)+u;
  return `<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}${H.form?` <span class="form-tag">${esc(H.form)}</span>`:""}</div><div></div><div class="r">${A.form?`<span class="form-tag">${esc(A.form)}</span> `:""}${esc(S.away)} ${logo(S.away)}</div></div>
    ${items.map(([k,l,u])=>{ const a=H[k]||0, b=A[k]||0, mx=Math.max(a,b,0.0001);
      const better = LOW_BETTER[k] ? (a<b?"h":b<a?"a":"") : (a>b?"h":b>a?"a":"");
      const wa = k==="poss" ? a : a/mx*100, wb = k==="poss" ? b : b/mx*100;
      return `<div class="cmp"><div class="cmp-v${better==="h"?" win":""}">${fmt(k,H[k],u)}</div>
        <div class="cmp-m"><span>${l}</span><div class="cmp-bar"><i><b style="width:${wa}%"></b></i><i><b style="width:${wb}%"></b></i></div></div>
        <div class="cmp-v r${better==="a"?" win":""}">${fmt(k,A[k],u)}</div></div>`; }).join("")}
    ${limit && STAT_ITEMS.filter(([k])=>H[k]!=null||A[k]!=null).length>limit?`<p style="margin-top:14px"><a class="btn" href="#match/${m.id}/stats">ALL STATS ›</a></p>`:""}`;
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
    row.sort((a,b)=>a.lat-b.lat || a.i-b.i).forEach((o,j)=>P.push({l:o.l, x: 10 + 80*(j+.5)/row.length, y})); });
  return P;
}
function pitchHtml(L, form, side){
  const P=placeXI(L, form);
  if(!P.length) return "";
  return `<div class="pitch"><div class="arc"></div>${P.map(({l,x,y})=>{
    const ic=`${l.g?"⚽".repeat(Math.min(l.g,3)):""}${l.yc?'<i class="ico-y"></i>':""}${l.rc?'<i class="ico-r"></i>':""}`;
    const inner=`<div class="pp-s">${l.no??""}${l.rating!=null?`<span class="pp-r rt ${rtCls(l.rating)}">${l.rating.toFixed(1)}</span>`:""}${ic?`<span class="pp-i">${ic}</span>`:""}</div><span class="pp-n">${esc(side==="me"?surname(l.name):l.name)}</span>`;
    return `<div class="pp ${side==="opp"?"opp":""} ${posGroup(l.pos)==="GK"?"gk":""}" style="left:${x}%;top:${y}%">${side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${inner}</a>`:inner}</div>`; }).join("")}</div>`;
}
function tabLineup(m,S){
  const col = side => { const L=m.lu[side], club= side==="me"?clubName():m.opp, form=(m.ts[side]||{}).form;
    if(!L.length) return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span></div>${empty("出場選手シートに入れると表示されます。")}</div>`;
    const subs=L.filter(l=>l.role==="途中出場"), bench=L.filter(l=>l.role==="ベンチ");
    const nm=l=> side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${esc(l.name)}</a>`:esc(l.name);
    return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span>${form?`<span class="form-tag">${esc(form)}</span>`:""}</div>
      ${pitchHtml(L, form, side)}
      ${subs.length?`<div class="subs"><h4>SUBSTITUTES <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">途中出場</small></h4><ul>${subs.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}${l.min!=null?`・${l.min}分`:""}</small>${rt(l.rating)}</li>`).join("")}</ul></div>`:""}
      ${bench.length?`<div class="subs"><h4>BENCH <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">ベンチ</small></h4><ul>${bench.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}</small></li>`).join("")}</ul></div>`:""}</div>`; };
  const side=ST.luSide==="opp"?"opp":"me", L=m.lu[side];
  const cols=[["出場",l=>l.role==="先発"?"先発":l.role==="途中出場"?"途中":"ベンチ"],["#",l=>l.no??""],["POS",l=>esc(l.pos)],["時間",l=>l.min??""],["評価",l=>rt(l.rating)],["G",l=>l.g||""],["A",l=>l.a||""],
    ["シュート",l=>l.sh??""],["パス%",l=>l.pass??""],["タックル",l=>l.tk??""],["セーブ",l=>l.sv??""],["警告",l=>l.yc?'<i class="ico-y"></i>':""],["退場",l=>l.rc?'<i class="ico-r"></i>':""]]
    .filter(([h,f])=>["出場","#","POS","評価"].includes(h) || L.some(l=>{ const v=f(l); return v!==""&&v!=null; }));
  return `<div class="lu-grid">${col(S.hSide)}${col(S.aSide)}</div>
    <div class="sub-h">PLAYER STATS<small>選手ごとの成績</small></div>
    <div class="pill-tabs" id="lu-side"><button class="pill${side==="me"?" on":""}" data-s="me">${esc(clubName())}</button><button class="pill${side==="opp"?" on":""}" data-s="opp">${esc(m.opp)}</button></div>
    ${L.length?`<div class="tw"><table class="t"><thead><tr><th class="l">名前</th>${cols.map(([h])=>`<th>${h}</th>`).join("")}</tr></thead><tbody>
      ${L.slice().sort((a,b)=>({"先発":0,"途中出場":1}[a.role]??2)-({"先発":0,"途中出場":1}[b.role]??2) || (POS_DEPTH[a.pos]??5)-(POS_DEPTH[b.pos]??5)).map(l=>`<tr><th class="l">${side==="me"?`<a href="#player/${encodeURIComponent(l.name)}">${esc(l.name)}</a>`:esc(l.name)}${same(l.name,m.mom)&&side==="me"?' <span class="cat">MOM</span>':""}</th>${cols.map(([,f])=>`<td>${f(l)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : empty("出場選手シートに入れると表示されます。")}`;
}
function tabTimeline(m,S){
  const kcls = k => /ゴール/.test(k)&&k!=="オウンゴール"?"goal" : k==="警告"?"y" : k==="退場"?"r" : k==="交代"?"sub" : "";
  const ev=m.ev; let ht=false;
  const rows=[];
  ev.forEach(e=>{
    if(!ht && e.mn>45.99 && ev.some(x=>x.mn<=45.99)){ rows.push(`<div class="tl-ht"><span>HALF TIME</span></div>`); ht=true; }
    const isHome = (e.side===S.hSide);
    const who = e.side==="me" ? (e.player?pLink(e.player):"") : (e.player?`<b>${esc(e.player)}</b>`:"");
    const sub = e.kind==="交代" ? (e.rel?`<small>OUT ${esc(e.rel)}</small>`:"") : /ゴール/.test(e.kind) && e.rel ? `<small>アシスト ${esc(e.rel)}</small>` : "";
    const txt=`<span class="tl-k ${kcls(e.kind)}">${esc(e.kind)}</span>${who}${sub}${e.note?`<small>${esc(e.note)}</small>`:""}`;
    rows.push(`<div class="tl-r"><div class="tl-e me">${isHome?txt:""}</div><div class="tl-m">${esc(e.min)}'</div><div class="tl-e">${isHome?"":txt}</div></div>`);
  });
  return `<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}</div><div></div><div class="r">${esc(S.away)} ${logo(S.away)}</div></div><div class="tl">${rows.join("")}<div class="tl-ht"><span>FULL TIME</span></div></div>`;
}

/* ---------- PLAYERS ---------- */
function squad(s){
  let rows=seasonRows(s).map(r=>({...r, prof:profile(r.name)}));
  let note="";
  if(!rows.length){ rows=D.players.map(p=>({ name:p.name, pos:p.pos, no:null, ovr:null, prof:p }));
    if(rows.length) note="選手成績シートか出場選手シートにこのシーズンの記録を入れると、シーズンごとの名簿になります。"; }
  rows.forEach(r=>{ if(r.ovr==null){ const x=D.stats.find(z=>z.season===s&&same(z.name,r.name)); if(x) r.ovr=x.ovr; } });
  return {rows, note};
}
function vPlayers(){
  const s=ST.season, {rows, note}=squad(s);
  const by={}; rows.forEach(r=>{ const g=posGroup(r.pos||(r.prof&&r.prof.pos)); (by[g]=by[g]||[]).push(r); });
  Object.values(by).forEach(L=>L.sort((a,b)=>(a.no??999)-(b.no??999) || (b.ovr||0)-(a.ovr||0)));
  return `${band("PLAYERS","選手一覧")}<div class="wrap">
    <div class="toolbar">${seasonSel("pl-season", s)}</div>
    ${rows.length? GROUPS.filter(([g])=>by[g]).map(([g,en,jp])=>`<div class="pos-h"><b>${en}</b><small>${jp}</small></div>
      <div class="pgrid">${by[g].map(r=>`<a class="pcard" href="#player/${encodeURIComponent(r.name)}"><div class="pic">${face(r.name)}
        ${r.no!=null?`<span class="no">${r.no}</span>`:""}${r.ovr?`<span class="ovr">${r.ovr}</span>`:""}</div>
        <div class="pos">${esc(r.pos||(r.prof&&r.prof.pos)||"")}</div><b>${esc(r.name)}</b>${r.prof&&r.prof.nat?`<small>${esc(r.prof.nat)}</small>`:""}</a>`).join("")}</div>`).join("")
      : empty("選手シート・選手成績シート・出場選手シートに入れると、ここに選手が並びます。")}
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
  const pos=(last&&last.pos)||(P&&P.pos)||"";
  const ovr=(D.stats.filter(r=>same(r.name,name)).slice(-1)[0]||{}).ovr;
  const prof=[["国籍",P&&P.nat],["生年月日",P&&P.birth?`${fmtD(P.birth)}（${ageAt(P.birth,ST.season||D.seasonList[0])}歳）`:P&&P.birthS],
    ["利き足",P&&P.foot],["身長",P&&P.height?`${P.height}cm`:""],["総合値",ovr],["ポテンシャル",P&&P.pot]].filter(([,v])=>v!=null&&v!=="");
  const tot=L.reduce((o,r)=>{ o.apps+=r.apps||0; o.g+=r.g||0; o.a+=r.a||0; o.cs+=r.cs||0; o.yc+=r.yc||0; o.rc+=r.rc||0; if(r.rating!=null&&r.apps){o.rs+=r.rating*r.apps;o.ra+=r.apps;} return o; },{apps:0,g:0,a:0,cs:0,yc:0,rc:0,rs:0,ra:0});
  const isGK=posGroup(pos)==="GK";
  return `<section class="pd" data-no="${last&&last.no!=null?last.no:""}"><div class="pd-in">
      <div class="pd-pic">${face(name)}</div>
      <div><div class="pd-pos">${esc(pos)}${pos?` / ${esc({GK:"GOALKEEPER",DF:"DEFENDER",MF:"MIDFIELDER",FW:"FORWARD"}[posGroup(pos)]||"")}`:""}</div>
        ${last&&last.no!=null?`<div class="pd-no">${last.no}</div>`:""}<h1 class="pd-name">${esc(name)}</h1>
        ${prof.length?`<dl class="pd-prof">${prof.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
        ${P&&P.memo?`<p class="pd-memo">${esc(P.memo)}</p>`:""}</div></div></section>
  <div class="wrap" style="max-width:1100px">
    <div class="crumb"><a href="#home">HOME</a> › <a href="#players">PLAYERS</a></div>
    <div class="sub-h" style="margin-top:0">STATS<small>シーズン成績</small></div>
    ${L.length?`<div class="tw"><table class="t"><thead><tr><th>シーズン</th><th>背番号</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th>${isGK?"<th>無失点</th>":""}<th>警告</th><th>退場</th></tr></thead>
      <tbody>${L.map(r=>`<tr><th>${esc(r.season)}</th><td class="num">${r.no??""}</td><td class="num">${r.apps??""}</td><td class="num">${r.g??""}</td><td class="num">${r.a??""}</td><td>${r.rating!=null?rt(r.rating):""}</td>${isGK?`<td class="num">${r.cs??""}</td>`:""}<td class="num">${r.yc??""}</td><td class="num">${r.rc??""}</td></tr>`).join("")}</tbody>
      ${L.length>1?`<tfoot><tr><th>通算</th><td></td><td class="num">${tot.apps}</td><td class="num">${tot.g}</td><td class="num">${tot.a}</td><td>${tot.ra?rt(tot.rs/tot.ra):""}</td>${isGK?`<td class="num">${tot.cs}</td>`:""}<td class="num">${tot.yc}</td><td class="num">${tot.rc}</td></tr></tfoot>`:""}</table></div>`
      : empty("選手成績シートか出場選手シートに入れると、シーズンごとの成績が出ます。")}
    ${log.length?`<div class="sub-h">MATCH LOG<small>出場した試合</small></div><div class="tw"><table class="t"><thead><tr><th>日付</th><th class="l">相手</th><th>結果</th><th>出場</th><th>時間</th><th>評価</th><th>G</th><th>A</th></tr></thead><tbody>
      ${log.slice().reverse().map(l=>`<tr><td>${fmtMD(l.m.date)}</td><td class="l"><a href="#match/${l.m.id}/lineup"><div class="t-club">${logo(l.m.opp)}${esc(l.m.opp)}</div></a></td><td><span class="res ${resCls(l.m)}" style="font-size:11px">${l.m.gf}-${l.m.ga}</span></td>
        <td>${l.role==="先発"?"先発":l.role==="途中出場"?"途中":"ベンチ"}</td><td class="num">${l.min??""}</td><td>${rt(l.rating)}</td><td class="num">${l.g||""}</td><td class="num">${l.a||""}</td></tr>`).join("")}</tbody></table></div>`
    : mg.length?`<div class="sub-h">HIGHLIGHTS<small>活躍した試合</small></div><div class="mlist">${mg.slice().reverse().map(m=>{ const S=sides(m);
        const g=sum(m.scorers.filter(x=>same(x.name,name)),x=>x.n), a=sum(m.assists.filter(x=>same(x.name,name)),x=>x.n);
        return `<a class="mrow" href="#match/${m.id}"><div class="mrow-d">${dateEN(m.date)}<span>${esc(m.comp)}</span></div>
          <div class="mrow-t r"><span>${esc(S.home)}</span>${logo(S.home)}</div><div class="mrow-s">${S.hs}-${S.as}</div><div class="mrow-t">${logo(S.away)}<span>${esc(S.away)}</span></div>
          <div class="mrow-r" style="font-size:12px;font-weight:700">${[g?`⚽×${g}`:"", a?`A×${a}`:"", same(m.mom,name)?"MOM":""].filter(Boolean).join(" ")}</div></a>`; }).join("")}</div>`:""}
    ${T.length?`<div class="sub-h">TRANSFER<small>移籍の記録</small></div><div class="tr-list">${T.map(trRow).join("")}</div>`:""}</div>`;
}

/* ---------- STATS ---------- */
const RK = [ ["g","GOALS","得点","点"], ["a","ASSISTS","アシスト",""], ["apps","APPEARANCES","出場","試合"], ["rating","RATING","平均評価",""], ["cs","CLEAN SHEETS","無失点",""], ["mom","MOM","MOM","回"] ];
function vStats(){
  const s=ST.stSeason;
  let rows=statRowsFor(s), src= s && D.stats.some(r=>r.season===s) ? "選手成績シート" : "出場選手シート";
  const fm=fromMatches(s);
  if(!rows.length){ rows=fm; src="試合シートの得点者・アシスト・MOM"; }
  else { const mm={}; fm.forEach(x=>mm[nameKey(x.name)]=x.mom); rows=rows.map(r=>({...r, mom:mm[nameKey(r.name)]||0})); }
  const avail=RK.filter(([k])=>rows.some(r=>r[k]));
  if(!avail.find(x=>x[0]===ST.rk)) ST.rk=(avail[0]||RK[0])[0];
  const [k,,,u]=RK.find(x=>x[0]===ST.rk);
  let R=rows.filter(r=>r[k]);
  if(k==="rating"){ const mx=Math.max(0,...rows.map(x=>x.apps||0)); R=R.filter(r=>(r.apps||0)>=Math.max(3, Math.round(mx*0.3))); }
  if(k==="cs") R=R.filter(r=>posGroup(r.pos||(profile(r.name)||{}).pos)==="GK" || r.cs);
  R.sort((a,b)=>b[k]-a[k]); R=R.slice(0,20);
  const L=ofSeason(s||null), tr=record(L);
  const TS=L.map(m=>m.ts.me).filter(Boolean), avg=(f)=>{ const v=TS.map(f).filter(x=>x!=null); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const big=L.filter(m=>m.res==="W"&&!m.draw).sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga))[0];
  const attL=L.filter(m=>m.att&&m.ha==="H");
  const tiles=[["勝率",tr.n?`${Math.round(tr.w/tr.n*100)}<small>%</small>`:"-",`${tr.w}勝${tr.d}分${tr.l}敗`],["1試合の得点",tr.n?(tr.gf/tr.n).toFixed(2):"-",`計 ${tr.gf}`],
    ["1試合の失点",tr.n?(tr.ga/tr.n).toFixed(2):"-",`計 ${tr.ga}`],["無失点試合",tr.cs,"試合"]];
  const ap=avg(t=>t.poss), as=avg(t=>t.sh), app=avg(t=>t.passp), ax=avg(t=>t.xg);
  if(ap!=null) tiles.push(["平均ボール支配率",`${ap.toFixed(1)}<small>%</small>`,`${TS.length}試合`]);
  if(as!=null) tiles.push(["平均シュート",as.toFixed(1),"本"]);
  if(app!=null) tiles.push(["平均パス成功率",`${app.toFixed(1)}<small>%</small>`,""]);
  if(ax!=null) tiles.push(["平均xG",ax.toFixed(2),""]);
  if(big) tiles.push(["最多得点差の勝利",`${big.gf}-${big.ga}`,`vs ${esc(big.opp)}`]);
  if(attL.length) tiles.push(["ホーム平均観客数",nf(Math.round(sum(attL,m=>m.att)/attL.length)),"人"]);
  return `${band("STATS","記録・ランキング")}<div class="wrap" style="max-width:1000px">
    <div class="toolbar">${seasonSel("st-season", s, true)}</div>
    ${L.length?`<div class="sub-h" style="margin-top:0">TEAM<small>チーム成績</small></div>
      <div class="chips">${tiles.map(([a,b,c])=>`<div class="chip"><span>${a}</span><b>${b}</b><span style="font-weight:500;color:var(--ink3)">${c}</span></div>`).join("")}</div>`:""}
    <div class="sub-h">PLAYERS<small>個人ランキング</small></div>
    ${avail.length?`<div class="tabs" id="st-tabs">${avail.map(([kk,en,jp])=>`<button class="tab${kk===k?" on":""}" data-k="${kk}">${en}<small>${jp}</small></button>`).join("")}</div>
      <div class="rk">${R.map((r,i)=>`<a class="rk-r" href="#player/${encodeURIComponent(r.name)}"><div class="rk-n">${i+1}</div>${face(r.name)}
        <div><b>${esc(r.name)}</b><small>${esc(r.pos||(profile(r.name)||{}).pos||"")}${r.apps?`・${r.apps}試合`:""}</small></div>
        <div class="rk-v">${k==="rating"?r[k].toFixed(2):r[k]}<small>${u}</small></div></a>`).join("")}</div>
      <p class="note">${src}から集計${k==="rating"?"（出場数が少ない選手は除いています）":""}</p>`
      : empty("選手成績・出場選手・試合シートの得点者のどれかを入れると、ランキングが出ます。")}</div>`;
}
function bStats(){ bindSel("st-season", v=>{ ST.stSeason=v; render(); }); document.querySelectorAll("#st-tabs .tab").forEach(b=>b.onclick=()=>{ ST.rk=b.dataset.k; render(); }); }

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
  player:   [null, null, "PLAYERS", vPlayerDetail],
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
  if(key!==lastKey){ window.scrollTo(0,0); lastKey=key; }
}
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
