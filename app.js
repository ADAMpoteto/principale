/* =====================================================================
   Principale ― FC27 監督キャリアの記録サイト
   データはGoogleスプレッドシートから読み込みます。

   ■ つなぎ方（どちらか1つ）
     A. スプシを「共有 → リンクを知っている全員（閲覧者）」にする
        → SHEET_ID にスプシのID（URLの /d/ と /edit の間）を入れるだけ
     B. スプシを「ファイル → 共有 → ウェブに公開」する
        → 公開したときのURL（どのシートのものでもOK）を PUB_URL に貼る
           （B のほうが読み込みが安定します。PUB_URL が入っていれば B を使います）

   ■ 画像（GitHubの images フォルダに、名前と同じファイル名で置くだけ）
     選手の写真   : images/player/上田 綺世.png   （.webp / .jpg でもOK。スペースなしの「上田綺世.png」でもOK）
     クラブのロゴ : images/logo/鹿島.png           （試合シートの「相手」と同じ名前）
     自分のクラブ : images/logo/Principale.png    （設定シートのクラブ名と同じ名前。なければこのファイル）
     画像がない選手・クラブは、頭文字の丸で表示します。
   ===================================================================== */
const SHEET_ID = "1ZRRBDpNq5W9pzgagLqxMQ8shDBI_vpNMLT8R_Wiezs8";
const PUB_URL  = "";   // 例："https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv"

const SHEETS = {   // [シート名, gid]
  match:  ["試合",     0],
  stats:  ["選手成績", 101],
  player: ["選手",     102],
  trans:  ["移籍",     103],
  season: ["シーズン", 104],
  table:  ["順位表",   105],
  conf:   ["設定",     106]
};
const DEFAULT_CLUB = "Principale";
const IMG_EXT = ["png", "webp", "jpg"];

/* ---------- 小物 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const half = s => String(s==null?"":s).replace(/[０-９．－，]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
const F = (o,k) => (o && o[k]!=null) ? String(o[k]).trim() : "";
function num(s){ const t=half(s).replace(/[,\s人万円€]/g,""); if(t==="") return null; const n=Number(t); return isFinite(n)?n:null; }
function pDate(s){ const m=half(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
const WD=["日","月","火","水","木","金","土"];
const fmtD = d => d ? `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}` : "";
const fmtDW = d => d ? `${fmtD(d)}（${WD[d.getDay()]}）` : "";
const fmtMD = d => d ? `${d.getMonth()+1}/${d.getDate()}` : "";
const nf = n => Number(n||0).toLocaleString("ja-JP");
const nameKey = s => String(s||"").replace(/[\s　・.]/g,"").toLowerCase();
const surname = s => String(s||"").trim().split(/[\s　]+/)[0];
const empty = msg => `<div class="empty">${esc(msg)}</div>`;

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
const IMG_OK = {};   // 見つかった画像を覚えておく
function imgCands(dir, names){
  const out=[]; names.filter(Boolean).forEach(n=>{
    const v=[String(n).trim(), String(n).replace(/[\s　]/g,"")];
    [...new Set(v)].forEach(b=>IMG_EXT.forEach(e=>out.push(`images/${dir}/${b}.${e}`)));
  });
  return [...new Set(out)];
}
function initials(name){
  const s=String(name||"").trim(); if(!s) return "?";
  if(/^[\x00-\x7F\s]+$/.test(s)){ const w=s.split(/\s+/).filter(Boolean); return (w.length>1? w[0][0]+w[1][0] : s.slice(0,2)).toUpperCase(); }
  return surname(s).slice(0,2);
}
function imgTag(cands, alt, cls, key){
  const known=IMG_OK[key];
  const list=known ? [known] : cands;
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
function logo(club, cls){
  const me=isMe(club);
  const names= me ? [clubName(), DEFAULT_CLUB] : [club];
  return imgTag(imgCands("logo",names), me?clubName():club, "logo "+(cls||""), "l:"+(me?"__me":nameKey(club)));
}

/* =====================================================================
   データ
   ===================================================================== */
const D = { matches:[], stats:[], players:[], trans:[], seasons:[], table:[], conf:{}, seasonList:[], news:[], loaded:false, err:"" };
const ST = { season:null, stSeason:"", trSeason:"", comp:"すべて", newsCat:"すべて", rk:"g", tblSeason:null, tblComp:null, trSeason:null };

const clubName = () => D.conf["クラブ名"] || DEFAULT_CLUB;
const unit = () => D.conf["通貨の単位"] || "";
function isMe(club){
  const k=nameKey(club); if(!k) return false;
  return k===nameKey(clubName()) || k===nameKey(D.conf["略称"]) || k===nameKey(DEFAULT_CLUB) || /自分/.test(club);
}
/* 「上田」→「上田 綺世」のように、選手シート・選手成績シートのフルネームにそろえる */
const NAME_CACHE = {};
function fullName(n){
  const s=String(n||"").trim(); if(!s) return s;
  if(NAME_CACHE[s]) return NAME_CACHE[s];
  const k=nameKey(s);
  const pool=[...D.players.map(p=>p.name), ...D.stats.map(r=>r.name)];
  let hit=pool.find(p=>nameKey(p)===k);
  if(!hit){ const c=[...new Set(pool.filter(p=>nameKey(surname(p))===k))]; if(c.length===1) hit=c[0]; }
  return NAME_CACHE[s]=hit||s;
}
/* 「上田 2、三笘」→ [{name:"上田 綺世", n:2}, {name:"三笘 薫", n:1}] */
function parseNames(s){
  return String(s||"").split(/[、,，\n／\/]/).map(t=>t.trim()).filter(Boolean).map(t=>{
    const m=half(t).match(/^(.*?)[\s　]*[（(×xX]?\s*(\d+)\s*[)）点]?$/);
    if(m && m[1].trim()) return { name:fullName(m[1].trim()), n:+m[2] };
    return { name:fullName(t), n:1 };
  });
}
/* PK：「4-3」。スプシが日付に変えてしまった「2026/04/03」「4/3」も読む */
function parsePK(s){
  const t=half(s).trim(); if(!t) return null;
  let m=t.match(/^(\d{1,2})\s*[-－ー:：]\s*(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^\d{4}\D(\d{1,2})\D(\d{1,2})/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^(\d{1,2})\/(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  return null;
}
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

  /* 設定 */
  got.conf.forEach(o=>{ const k=F(o,"項目"), v=F(o,"値"); if(k) D.conf[k]=v; });
  /* 選手・選手成績（先に読む：名前をそろえるのに使う） */
  D.players=got.player.map(o=>({ name:F(o,"名前"), pos:F(o,"ポジション").toUpperCase(), nat:F(o,"国籍"), birth:pDate(F(o,"生年月日")), birthS:F(o,"生年月日"),
    foot:F(o,"利き足"), height:num(F(o,"身長")), pot:num(F(o,"ポテンシャル")), memo:F(o,"メモ") })).filter(p=>p.name);
  D.stats=got.stats.map(o=>({ season:F(o,"シーズン"), name:F(o,"名前"), no:num(F(o,"背番号")), pos:F(o,"ポジション").toUpperCase(), ovr:num(F(o,"総合値")),
    apps:num(F(o,"出場")), g:num(F(o,"得点")), a:num(F(o,"アシスト")), rating:num(F(o,"平均評価")), cs:num(F(o,"クリーンシート")),
    yc:num(F(o,"警告")), rc:num(F(o,"退場")) })).filter(r=>r.name && r.season);
  /* 試合 */
  D.matches=got.match.map((o,i)=>{
    const gf=num(F(o,"得点")), ga=num(F(o,"失点")), opp=F(o,"相手");
    if(gf==null || ga==null || !opp) return null;
    const pk=parsePK(F(o,"PK"));
    const res = gf>ga?"W" : gf<ga?"L" : pk ? (pk.a>pk.b?"W":"L") : "D";
    let ha=F(o,"H/A").toUpperCase(); ha = /^A/.test(ha)?"A" : /^N/.test(ha)?"N" : "H";
    return { i, season:F(o,"シーズン"), date:pDate(F(o,"日付")), comp:F(o,"大会")||"試合", round:F(o,"節・回戦"), ha, opp, gf, ga, pk, res,
      draw: gf===ga, scorers:parseNames(F(o,"得点者")), assists:parseNames(F(o,"アシスト")), mom:fullName(F(o,"MOM")),
      att:num(F(o,"観客数")), memo:F(o,"メモ") };
  }).filter(Boolean);
  D.matches.sort((a,b)=>(a.date&&b.date? a.date-b.date : 0) || a.i-b.i);
  D.matches.forEach((m,k)=>m.id=k+1);
  /* 移籍・シーズン・順位表 */
  D.trans=got.trans.map((o,i)=>({ i, season:F(o,"シーズン"), date:pDate(F(o,"日付")), kind:F(o,"区分")||"加入", name:fullName(F(o,"名前")),
    club:F(o,"相手クラブ"), fee:num(F(o,"移籍金")), memo:F(o,"メモ") })).filter(t=>t.name);
  D.seasons=got.season.map(o=>({ season:F(o,"シーズン"), league:F(o,"リーグ"), rank:half(F(o,"リーグ順位")).replace(/位$/,""), cup:F(o,"国内カップ"),
    lcup:F(o,"リーグカップ"), intl:F(o,"国際大会"), cap:fullName(F(o,"主将")), comment:F(o,"一言") })).filter(s=>s.season);
  D.table=got.table.map(o=>({ season:F(o,"シーズン"), comp:F(o,"大会"), rank:num(F(o,"順位")), club:F(o,"クラブ"), p:num(F(o,"試合")),
    w:num(F(o,"勝")), d:num(F(o,"分")), l:num(F(o,"負")), gf:num(F(o,"得点")), ga:num(F(o,"失点")), pts:num(F(o,"勝点")) })).filter(r=>r.club);

  const ss=new Set([...D.matches,...D.stats,...D.trans,...D.seasons,...D.table].map(x=>x.season).filter(Boolean));
  if(D.conf["最初のシーズン"] && !ss.size) ss.add(D.conf["最初のシーズン"]);
  D.seasonList=[...ss].sort().reverse();
  ST.season = D.seasonList[0] || null;
  ST.stSeason = ST.trSeason = ST.season || "";
  buildNews();
  D.loaded=true;
  $("hd-name").textContent=clubName(); $("ft-name").textContent=clubName();
}

/* ---------- 集計 ---------- */
const ofSeason = s => D.matches.filter(m=>!s || m.season===s);
function record(L){
  const r={n:L.length,w:0,d:0,l:0,gf:0,ga:0,cs:0};
  L.forEach(m=>{ if(m.draw) r.d++; else if(m.res==="W") r.w++; else r.l++; r.gf+=m.gf; r.ga+=m.ga; if(m.ga===0) r.cs++; });
  return r;
}
function seasonInfo(s){ return D.seasons.find(x=>x.season===s) || null; }
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
/* 選手のシーズン成績：選手成績シートがあればそれ、なければ試合シートから得点・アシスト・MOMを数える */
function fromMatches(s){
  const M={}; const add=(n,k,v)=>{ if(!n) return; (M[n]=M[n]||{name:n,g:0,a:0,mom:0})[k]+=v; };
  ofSeason(s).forEach(m=>{ m.scorers.forEach(x=>add(x.name,"g",x.n)); m.assists.forEach(x=>add(x.name,"a",x.n)); if(m.mom) add(m.mom,"mom",1); });
  return Object.values(M);
}
function statRowsFor(s){
  const rows = s ? D.stats.filter(r=>r.season===s) : D.stats;
  if(!s){ /* 通算：名前ごとに合計 */
    const M={}; rows.forEach(r=>{ const k=r.name; const o=M[k]=M[k]||{name:k,apps:0,g:0,a:0,cs:0,yc:0,rc:0,_rs:0,_ra:0,seasons:0};
      o.apps+=r.apps||0; o.g+=r.g||0; o.a+=r.a||0; o.cs+=r.cs||0; o.yc+=r.yc||0; o.rc+=r.rc||0; o.seasons++;
      if(r.rating!=null && r.apps){ o._rs+=r.rating*r.apps; o._ra+=r.apps; } o.pos=r.pos||o.pos; });
    return Object.values(M).map(o=>({...o, rating:o._ra? o._rs/o._ra : null}));
  }
  return rows;
}
function seasonsOfPlayer(name){ const k=nameKey(name); return D.stats.filter(r=>nameKey(r.name)===k).sort((a,b)=>a.season<b.season?-1:1); }
function latestStat(name){ const L=seasonsOfPlayer(name); return L[L.length-1]||null; }
function profile(name){ const k=nameKey(name); return D.players.find(p=>nameKey(p.name)===k) || null; }
function ageAt(birth, season){
  if(!birth) return null; const y=parseInt(season,10); const ref=y? new Date(y,7,1) : new Date();
  let a=ref.getFullYear()-birth.getFullYear(); if(ref < new Date(ref.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a;
}
const IN_K=["加入","レンタル加入","昇格","レンタル復帰"], OUT_K=["退団","レンタル移籍"];
const trDir = k => IN_K.includes(k)?"in" : OUT_K.includes(k)?"out" : "etc";
const money = v => v==null ? "" : `${nf(v)}${esc(unit())}`;

/* =====================================================================
   ニュース（試合・移籍・シーズンの行から自動で作る）
   ===================================================================== */
const KIND_EN = { "加入":"NEW COMER", "レンタル加入":"NEW COMER", "昇格":"PROMOTION", "レンタル復帰":"WELCOME BACK", "退団":"FAREWELL", "レンタル移籍":"ON LOAN", "契約延長":"CONTRACT RENEWAL" };
const resWord = m => m.draw ? (m.pk ? (m.res==="W"?"PK戦の末に勝利":"PK戦の末に敗退") : "引き分け") : m.res==="W" ? "勝利" : "敗戦";
const resEN = m => m.draw && m.pk ? (m.res==="W"?"WIN (PK)":"LOSE (PK)") : m.draw?"DRAW" : m.res==="W"?"WIN":"LOSE";
const resCls = m => m.draw && !m.pk ? "D" : m.res;
const compRound = m => [m.comp, m.round].filter(Boolean).join(" ");

function buildNews(){
  const N=[];
  D.matches.forEach(m=>N.push({ id:"m"+m.id, cat:"MATCH", date:m.date, sort:m.date, m,
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
    const sort= last ? new Date(last.getTime()+86400000) : null;
    const t=titlesOf(S);
    N.push({ id:"s"+S.season, cat:"SEASON", date:null, sort, S,
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
function mark(){ return `<div class="nv-mark">${logo(clubName())}<span>${esc(clubName())}</span></div>`; }
function visual(n){
  if(n.m){ const m=n.m, me=clubName(); const L= m.ha==="A" ? [m.opp,me,m.ga,m.gf] : [me,m.opp,m.gf,m.ga];
    return `<div class="nv m ${resCls(m)}">
      <div class="nv-comp">${esc(compRound(m))}</div><div class="nv-res">${resEN(m)}</div>
      <div class="nv-board"><div class="nv-team">${logo(L[0])}${esc(L[0])}</div>
        <div class="nv-score">${L[2]} - ${L[3]}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}</div>
        <div class="nv-team">${logo(L[1])}${esc(L[1])}</div></div>
      <div class="nv-date">${fmtD(m.date)}</div>${mark()}</div>`; }
  if(n.t){ const t=n.t, P=profile(t.name), s=D.stats.find(r=>r.season===t.season && nameKey(r.name)===nameKey(t.name)) || latestStat(t.name);
    const dir=trDir(t.kind);
    const rows=[["NUMBER", s&&s.no!=null?s.no:""],["POSITION",(s&&s.pos)||(P&&P.pos)||""],["NATIONALITY",P&&P.nat||""],
      [dir==="out"?"NEXT CLUB":"PREVIOUS CLUB", t.club]].filter(r=>r[1]!=="" && r[1]!=null);
    return `<div class="nv t ${dir==="out"?"out":""}">
      <div class="nv-kind">${esc(KIND_EN[t.kind]||t.kind)}<small>${esc(t.kind)}</small></div>
      <div class="nv-name">${esc(t.name)}</div>
      <dl class="nv-dl">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="nv-photo">${face(t.name)}</div>${mark()}</div>`; }
  const S=n.S, r=record(ofSeason(S.season)), t=titlesOf(S);
  return `<div class="nv s"><div class="nv-sn">${esc(S.season)} SEASON</div>
    <div class="nv-sbig">${S.rank?`${esc(S.rank)}<small>位</small>`:`${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small>`}</div>
    <div class="nv-stt">${t.length? t.map(x=>`<span>🏆 ${esc(x)}</span>`).join("") : esc(S.league||"")}</div>${mark()}</div>`;
}
function newsCard(n){
  return `<a class="nc" href="#news/${encodeURIComponent(n.id)}">${visual(n)}
    <div class="nc-meta"><span class="cat ${n.cat}">${n.cat}</span><span>${n.date?fmtD(n.date):esc((n.S&&n.S.season)||"")}</span></div>
    <h3>${esc(n.title)}</h3></a>`;
}
function newsBody(n){
  const P=[];
  if(n.m){ const m=n.m;
    P.push(`<p>${fmtDW(m.date)}、${esc(compRound(m))}で${m.ha==="H"?"ホームに":m.ha==="A"?"アウェイで":"中立地で"}${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk?`（PK ${m.pk.a}-${m.pk.b}）`:""}で${resWord(m)}しました。</p>`);
    if(m.scorers.length) P.push(`<p>得点は${m.scorers.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}点）`:""}`).join("、")}。${m.assists.length?`アシストは${m.assists.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}）`:""}`).join("、")}が記録しました。`:""}</p>`);
    else if(m.gf===0) P.push(`<p>攻撃陣はゴールを奪えませんでした。</p>`);
    if(m.mom) P.push(`<p>マン・オブ・ザ・マッチには${pLink(m.mom)}が選ばれました。</p>`);
    if(m.att) P.push(`<p>観客数：${nf(m.att)}人</p>`);
    if(m.memo) P.push(`<h2>監督メモ</h2><p>${esc(m.memo)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#match/${m.id}">試合の詳細を見る</a></div>`);
  } else if(n.t){ const t=n.t, dir=trDir(t.kind);
    const club=t.club?esc(t.club):"";
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
      if(it.length) P.push(`<p>${it.join("　")}</p>`); }
    if(t.memo) P.push(`<h2>メモ</h2><p>${esc(t.memo)}</p>`);
    if(dir!=="out") P.push(`<div class="nd-link"><a class="btn" href="#player/${encodeURIComponent(t.name)}">選手ページを見る</a></div>`);
  } else { const S=n.S, r=record(ofSeason(S.season));
    P.push(`<p>${esc(S.season)}シーズンが終了しました。${S.league?`${esc(S.league)}は${S.rank?`${esc(S.rank)}位`:""}`:""}${r.n?`、公式戦${r.n}試合で${r.w}勝${r.d}分${r.l}敗（${r.gf}得点・${r.ga}失点）`:""}でした。</p>`);
    const cups=[["国内カップ",S.cup],["リーグカップ",S.lcup],["国際大会",S.intl]].filter(x=>x[1]);
    if(cups.length) P.push(`<p>${cups.map(([k,v])=>`${k}：${esc(v)}`).join("　")}</p>`);
    const top=topOf(S.season,"g"); if(top) P.push(`<p>チーム得点王は${pLink(top.name)}（${top.g}点）。</p>`);
    if(S.cap) P.push(`<p>主将：${pLink(S.cap)}</p>`);
    if(S.comment) P.push(`<h2>監督のひとこと</h2><p>${esc(S.comment)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#history">クラブの歴史を見る</a></div>`);
  }
  return P.join("");
}
const pLink = n => `<a href="#player/${encodeURIComponent(n)}"><b>${esc(n)}</b></a>`;
function topOf(s, k){
  let rows=statRowsFor(s).filter(r=>r[k]); if(!rows.length) rows=fromMatches(s).filter(r=>r[k]);
  rows.sort((a,b)=>b[k]-a[k]); return rows[0]||null;
}

/* =====================================================================
   画面
   ===================================================================== */
function seasonSel(id, val, all){
  const opts=(all?[["","通算"]]:[]).concat(D.seasonList.map(s=>[s,`${s}シーズン`]));
  if(!opts.length) return "";
  return `<select class="sel" id="${id}" aria-label="シーズンを選ぶ">${opts.map(([v,l])=>`<option value="${esc(v)}"${v===(val||"")?" selected":""}>${esc(l)}</option>`).join("")}</select>`;
}
function bindSel(id, fn){ const el=$(id); if(el) el.onchange=()=>fn(el.value); }
function head(t, sub){ return `<h1 class="h1">${t}</h1>${sub?`<p class="h1-sub">${sub}</p>`:""}`; }

/* 試合カード（元のPrincipaleの形） */
function matchCard(m){
  const me=clubName();
  return `<a class="mc" href="#match/${m.id}">
    <div class="mc-comp">${esc(m.comp)}${m.round?`｜${esc(m.round)}`:""}</div>
    <div class="mc-ha"><span class="ha ${m.ha}">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
    <div class="mc-body">
      <div class="mc-team">${logo(me)}${esc(me)}</div>
      <div class="mc-score"><b>${m.gf}-${m.ga}</b>${m.pk?`<span class="pk">PK ${m.pk.a}-${m.pk.b}</span>`:""}<span class="d">${fmtDW(m.date)}</span></div>
      <div class="mc-team">${logo(m.opp)}${esc(m.opp)}</div>
    </div>
    <div class="mc-res"><span class="res ${resCls(m)}">${resEN(m)}</span></div></a>`;
}

/* ---------- HOME ---------- */
function vHome(){
  const s=ST.season, L=ofSeason(s), r=record(L), rk=myRank(s), lg=leagueName(s);
  const latest=D.matches.slice(-2).reverse();
  const g=topOf(s,"g"), a=topOf(s,"a");
  return `<div class="wrap">
    <div class="hero">${logo(clubName(),"hero-logo")}
      <div><div class="hero-s">${s?`${esc(s)} SEASON`:"FC27 CAREER"}</div>
        <div class="hero-rec">${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></div>
        <div class="hero-meta">${[lg&&rk?`${esc(lg)} ${esc(rk)}位`:lg?esc(lg):"", r.n?`${r.gf}得点・${r.ga}失点`:"", D.conf["監督名"]?`監督 ${esc(D.conf["監督名"])}`:""].filter(Boolean).join("　")||"スプシに試合を入れると、ここに成績が出ます"}</div></div>
    </div>
    <h2 class="h1" style="margin-top:34px">MATCH RESULT</h2>
    ${latest.length?`<div class="mc-grid">${latest.map(matchCard).join("")}</div><div class="more"><a class="btn" href="#match">MORE</a></div>`:empty("試合シートに入れると、最新の試合結果が出ます。")}
    <h2 class="h1" style="margin-top:34px">NEWS</h2>
    ${D.news.length?`<div class="nc-grid">${D.news.slice(0,6).map(newsCard).join("")}</div><div class="more"><a class="btn" href="#news">MORE</a></div>`:empty("試合・移籍・シーズンのシートに入れると、ニュースが自動でできます。")}
    ${(g||a)?`<h2 class="h1" style="margin-top:34px">TOP PLAYERS</h2><div class="mc-grid">
      ${g?rkMini("得点王", g, g.g, "点"):""}${a?rkMini("アシスト王", a, a.a, ""):""}</div>`:""}
  </div>`;
}
function rkMini(lbl, r, v, u){
  return `<a class="rk-r" href="#player/${encodeURIComponent(r.name)}" style="grid-template-columns:56px 1fr auto">
    ${face(r.name)}<div><small>${lbl}</small><b>${esc(r.name)}</b></div><div class="rk-v">${v}<small>${u}</small></div></a>`;
}

/* ---------- NEWS ---------- */
function vNews(){
  const cats=["すべて","MATCH","TRANSFER","SEASON"];
  const L=D.news.filter(n=>ST.newsCat==="すべて"||n.cat===ST.newsCat);
  return `<div class="wrap">${head("NEWS","試合・移籍・シーズンの記録から自動で作っています")}
    <div class="tabs" id="nw-tabs">${cats.map(c=>`<button class="tab${c===ST.newsCat?" on":""}" data-c="${c}">${c}</button>`).join("")}</div>
    ${L.length?`<div class="nc-grid">${L.map(newsCard).join("")}</div>`:empty("まだニュースはありません。")}</div>`;
}
function bNews(){ document.querySelectorAll("#nw-tabs .tab").forEach(b=>b.onclick=()=>{ ST.newsCat=b.dataset.c; render(); }); }
function vNewsDetail(id){
  const n=D.news.find(x=>x.id===id); if(!n) return `<div class="wrap"><a class="back" href="#news">NEWS</a>${empty("ニュースが見つかりません。")}</div>`;
  const i=D.news.indexOf(n), nx=D.news[i-1], pv=D.news[i+1];
  return `<div class="wrap" style="max-width:820px"><a class="back" href="#news">NEWS</a>
    <article class="nd">${visual(n)}
      <h1>${esc(n.title)}</h1><div class="nd-meta"><span class="cat ${n.cat}">${n.cat}</span><span>${n.date?fmtDW(n.date):esc((n.S&&n.S.season)||"")}</span></div>
      <div class="nd-body">${newsBody(n)}</div></article>
    <div class="md-nav">${pv?`<a href="#news/${encodeURIComponent(pv.id)}">‹ ${esc(pv.title)}</a>`:"<span></span>"}${nx?`<a href="#news/${encodeURIComponent(nx.id)}">${esc(nx.title)} ›</a>`:""}</div></div>`;
}

/* ---------- MATCH ---------- */
function vMatch(){
  const s=ST.season, L0=ofSeason(s), comps=["すべて",...new Set(L0.map(m=>m.comp))];
  if(!comps.includes(ST.comp)) ST.comp="すべて";
  const L=L0.filter(m=>ST.comp==="すべて"||m.comp===ST.comp), r=record(L);
  return `<div class="wrap">${head("MATCH")}
    <div class="toolbar">${seasonSel("mt-season", s)}</div>
    <div class="tabs" id="mt-tabs">${comps.map(c=>`<button class="tab${c===ST.comp?" on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    ${r.n?`<div class="chips"><span class="chip"><b>${r.n}</b>試合</span><span class="chip"><b>${r.w}</b>勝 <b>${r.d}</b>分 <b>${r.l}</b>敗</span>
      <span class="chip">得点 <b>${r.gf}</b></span><span class="chip">失点 <b>${r.ga}</b></span><span class="chip">無失点 <b>${r.cs}</b></span></div>`:""}
    ${L.length?`<div class="ml">${L.slice().reverse().map(m=>`<a class="mr" href="#match/${m.id}">
      <div class="mr-d">${fmtMD(m.date)}<small>${esc(m.round||m.comp)}</small></div>
      <div class="mr-o">${logo(m.opp)}<div style="min-width:0"><span>${esc(m.opp)}</span><em><span class="ha ${m.ha}" style="font-size:9px;padding:0 5px">${m.ha}</span> ${esc(m.comp)}</em></div></div>
      <div class="mr-s">${m.gf}-${m.ga}${m.pk?`<small>PK ${m.pk.a}-${m.pk.b}</small>`:""}</div>
      <span class="res ${resCls(m)}">${m.draw&&!m.pk?"D":m.res}</span></a>`).join("")}</div>`:empty("試合シートに入れると、ここに試合が並びます。")}</div>`;
}
function bMatch(){ bindSel("mt-season", v=>{ ST.season=v; render(); }); document.querySelectorAll("#mt-tabs .tab").forEach(b=>b.onclick=()=>{ ST.comp=b.dataset.c; render(); }); }
function vMatchDetail(id){
  const m=D.matches.find(x=>x.id===+id); if(!m) return `<div class="wrap"><a class="back" href="#match">MATCH</a>${empty("試合が見つかりません。")}</div>`;
  const me=clubName(), home= m.ha==="A"? m.opp : me, away= m.ha==="A"? me : m.opp;
  const hs= m.ha==="A"? m.ga : m.gf, as= m.ha==="A"? m.gf : m.ga;
  const pv=D.matches.find(x=>x.id===m.id-1), nx=D.matches.find(x=>x.id===m.id+1);
  const list=(L, ico)=> L.length? `<ul>${L.map(x=>`<li>${ico}<a href="#player/${encodeURIComponent(x.name)}">${esc(x.name)}</a>${x.n>1?` ×${x.n}`:""}</li>`).join("")}</ul>` : `<p style="color:var(--ink3);font-size:13px">なし</p>`;
  const ball=`<img src="images/icon/soccerball.png" alt="" onerror="this.remove()">`;
  return `<div class="wrap" style="max-width:820px"><a class="back" href="#match">MATCH</a>
    <div class="md-top"><div class="md-comp">${esc(compRound(m))}</div><div class="md-date">${fmtDW(m.date)}　<span class="ha ${m.ha}">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
      <div class="md-board"><div class="md-team">${logo(home)}${esc(home)}</div>
        <div class="md-score">${hs} - ${as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b} - ${m.pk.a}`:`${m.pk.a} - ${m.pk.b}`}</small>`:""}</div>
        <div class="md-team">${logo(away)}${esc(away)}</div></div>
      <div class="md-res"><span class="res ${resCls(m)}">${resEN(m)}</span></div></div>
    <div class="md-sc"><div class="md-box"><h3>GOAL｜得点者</h3>${list(m.scorers, ball)}</div><div class="md-box"><h3>ASSIST｜アシスト</h3>${list(m.assists, "")}</div></div>
    <div class="md-info">
      ${m.mom?`<a class="md-box md-mom" href="#player/${encodeURIComponent(m.mom)}" style="grid-column:1/-1">${face(m.mom)}<div><h3>MAN OF THE MATCH</h3><b>${esc(m.mom)}</b></div></a>`:""}
      ${m.att?`<div class="md-box"><h3>観客数</h3><b style="font-size:20px">${nf(m.att)}</b> 人</div>`:""}
      <div class="md-box"><h3>シーズン</h3><b style="font-size:18px">${esc(m.season||"-")}</b></div>
    </div>
    ${m.memo?`<div class="md-memo">${esc(m.memo)}</div>`:""}
    <div class="md-nav">${pv?`<a href="#match/${pv.id}">‹ ${fmtMD(pv.date)} ${esc(pv.opp)}</a>`:"<span></span>"}${nx?`<a href="#match/${nx.id}">${fmtMD(nx.date)} ${esc(nx.opp)} ›</a>`:""}</div></div>`;
}

/* ---------- PLAYERS ---------- */
function squad(s){
  let rows=D.stats.filter(r=>r.season===s).map(r=>({...r, prof:profile(r.name)}));
  let note="";
  if(!rows.length){
    rows=D.players.map(p=>({ name:p.name, pos:p.pos, no:null, ovr:null, prof:p }));
    if(rows.length) note="選手成績シートにこのシーズンの行を入れると、背番号・総合値つきでシーズンごとの名簿になります。";
  }
  return {rows, note};
}
function vPlayers(){
  const s=ST.season, {rows, note}=squad(s);
  const by={}; rows.forEach(r=>{ const g=posGroup(r.pos||(r.prof&&r.prof.pos)); (by[g]=by[g]||[]).push(r); });
  Object.values(by).forEach(L=>L.sort((a,b)=>(a.no??999)-(b.no??999) || (b.ovr||0)-(a.ovr||0)));
  return `<div class="wrap">${head("PLAYERS")}
    <div class="toolbar">${seasonSel("pl-season", s)}</div>
    ${rows.length? GROUPS.filter(([g])=>by[g]).map(([g,en,jp])=>`<div class="pg"><div class="pg-h"><b>${g}</b>${en}<span style="font-weight:600;letter-spacing:0">${jp}</span></div>
      <div class="pc-grid">${by[g].map(r=>`<a class="pc" href="#player/${encodeURIComponent(r.name)}">${face(r.name)}
        ${r.no!=null?`<span class="pc-no">${r.no}</span>`:""}${r.ovr?`<span class="pc-ovr">${r.ovr}</span>`:""}
        <div class="pc-b"><b>${esc(r.name)}</b><span>${esc(r.pos||(r.prof&&r.prof.pos)||"")}${r.prof&&r.prof.nat?`・${esc(r.prof.nat)}`:""}</span></div></a>`).join("")}</div></div>`).join("")
      : empty("選手シート・選手成績シートに入れると、ここに選手が並びます。")}
    ${note?`<p class="note">${esc(note)}</p>`:""}</div>`;
}
function bPlayers(){ bindSel("pl-season", v=>{ ST.season=v; render(); }); }
function vPlayerDetail(name){
  name=fullName(name);
  const P=profile(name), L=seasonsOfPlayer(name), last=L[L.length-1];
  const mg=D.matches.filter(m=>m.scorers.some(x=>nameKey(x.name)===nameKey(name)) || m.assists.some(x=>nameKey(x.name)===nameKey(name)) || nameKey(m.mom)===nameKey(name));
  const T=D.trans.filter(t=>nameKey(t.name)===nameKey(name));
  if(!P && !L.length && !mg.length && !T.length) return `<div class="wrap"><a class="back" href="#players">PLAYERS</a>${empty("選手が見つかりません。")}</div>`;
  const pos=(last&&last.pos)||(P&&P.pos)||"";
  const prof=[["ポジション",pos],["国籍",P&&P.nat],["生年月日",P&&P.birth?`${fmtD(P.birth)}（${ageAt(P.birth,ST.season||D.seasonList[0])}歳）`:P&&P.birthS],
    ["利き足",P&&P.foot],["身長",P&&P.height?`${P.height}cm`:""],["総合値",last&&last.ovr],["ポテンシャル",P&&P.pot]].filter(([,v])=>v!=null&&v!=="");
  const tot=L.reduce((o,r)=>{ o.apps+=r.apps||0; o.g+=r.g||0; o.a+=r.a||0; o.cs+=r.cs||0; o.yc+=r.yc||0; o.rc+=r.rc||0; if(r.rating!=null&&r.apps){o.rs+=r.rating*r.apps;o.ra+=r.apps;} return o; },{apps:0,g:0,a:0,cs:0,yc:0,rc:0,rs:0,ra:0});
  const isGK=posGroup(pos)==="GK";
  return `<div class="wrap" style="max-width:900px"><a class="back" href="#players">PLAYERS</a>
    <div class="pd-top"><div class="pd-photo">${face(name)}</div>
      <div>${last&&last.no!=null?`<div class="pd-no">${last.no}</div>`:""}<div class="pd-name">${esc(name)}</div><div class="pd-pos">${esc(pos)}${last?`・${esc(last.season)}`:""}</div>
        ${prof.length?`<dl class="pd-prof">${prof.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
        ${P&&P.memo?`<p class="pd-memo">${esc(P.memo)}</p>`:""}</div></div>
    <h2 class="h2">シーズン成績</h2>
    ${L.length?`<div class="tw"><table class="t"><thead><tr><th>シーズン</th><th>背番号</th><th>総合値</th><th>出場</th><th>得点</th><th>アシスト</th><th>平均評価</th>${isGK?"<th>CS</th>":""}<th>警告</th><th>退場</th></tr></thead>
      <tbody>${L.map(r=>`<tr><th>${esc(r.season)}</th><td>${r.no??""}</td><td>${r.ovr??""}</td><td>${r.apps??""}</td><td>${r.g??""}</td><td>${r.a??""}</td><td>${r.rating!=null?r.rating.toFixed(2):""}</td>${isGK?`<td>${r.cs??""}</td>`:""}<td>${r.yc??""}</td><td>${r.rc??""}</td></tr>`).join("")}</tbody>
      ${L.length>1?`<tfoot><tr><th>通算</th><td></td><td></td><td>${tot.apps}</td><td>${tot.g}</td><td>${tot.a}</td><td>${tot.ra?(tot.rs/tot.ra).toFixed(2):""}</td>${isGK?`<td>${tot.cs}</td>`:""}<td>${tot.yc}</td><td>${tot.rc}</td></tr></tfoot>`:""}</table></div>`
      : empty("選手成績シートに入れると、シーズンごとの成績が出ます。")}
    ${mg.length?`<h2 class="h2">活躍した試合</h2><div class="ml">${mg.slice().reverse().map(m=>{
        const g=m.scorers.filter(x=>nameKey(x.name)===nameKey(name)).reduce((a,x)=>a+x.n,0), a=m.assists.filter(x=>nameKey(x.name)===nameKey(name)).reduce((s,x)=>s+x.n,0);
        return `<a class="mr" href="#match/${m.id}"><div class="mr-d">${fmtMD(m.date)}<small>${esc(m.season)}</small></div>
          <div class="mr-o">${logo(m.opp)}<div style="min-width:0"><span>${esc(m.opp)}</span><em>${esc(compRound(m))}</em></div></div>
          <div class="mr-s" style="font-size:13px">${[g?`⚽${g>1?`×${g}`:""}`:"", a?`🅰${a>1?`×${a}`:""}`:"", nameKey(m.mom)===nameKey(name)?"MOM":""].filter(Boolean).join(" ")}<small>${m.gf}-${m.ga}</small></div>
          <span class="res ${resCls(m)}">${m.draw&&!m.pk?"D":m.res}</span></a>`; }).join("")}</div>`:""}
    ${T.length?`<h2 class="h2">移籍の記録</h2><div class="tr-list">${T.map(trRow).join("")}</div>`:""}</div>`;
}

/* ---------- STATS ---------- */
const RK = [ ["g","得点","点"], ["a","アシスト",""], ["apps","出場","試合"], ["rating","平均評価",""], ["cs","クリーンシート",""], ["mom","MOM","回"] ];
function vStats(){
  const s=ST.stSeason;
  let rows=statRowsFor(s), src="選手成績シートから";
  const fm=fromMatches(s);
  const hasSheet=rows.length>0;
  if(!hasSheet){ rows=fm; src="試合シートの得点者・アシスト・MOMから"; }
  else { const mm={}; fm.forEach(x=>mm[nameKey(x.name)]=x.mom); rows=rows.map(r=>({...r, mom:mm[nameKey(r.name)]||0})); }
  const avail=RK.filter(([k])=>rows.some(r=>r[k]));
  if(!avail.find(x=>x[0]===ST.rk)) ST.rk=(avail[0]||RK[0])[0];
  const [k,lbl,u]=RK.find(x=>x[0]===ST.rk);
  let R=rows.filter(r=>r[k]);
  if(k==="rating") R=R.filter(r=>(r.apps||0)>=Math.max(5, Math.round(Math.max(...rows.map(x=>x.apps||0))*0.3)));
  if(k==="cs") R=R.filter(r=>posGroup(r.pos||(profile(r.name)||{}).pos)==="GK" || r.cs);
  R.sort((a,b)=>b[k]-a[k]); R=R.slice(0,20);
  const L=ofSeason(s||null), tr=record(L);
  const big=L.filter(m=>m.res==="W"&&!m.draw).sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga))[0];
  const attL=L.filter(m=>m.att&&m.ha==="H");
  return `<div class="wrap" style="max-width:900px">${head("STATS")}
    <div class="toolbar">${seasonSel("st-season", s, true)}</div>
    ${L.length?`<h2 class="h2">TEAM</h2><div class="team-grid">
      <div class="tg"><span>成績</span><b>${tr.w}-${tr.d}-${tr.l}</b><small>${tr.n}試合・勝率 ${tr.w+tr.l?Math.round(tr.w/(tr.w+tr.l+tr.d)*100):0}%</small></div>
      <div class="tg"><span>得点</span><b>${tr.gf}</b><small>1試合 ${(tr.gf/tr.n).toFixed(2)}</small></div>
      <div class="tg"><span>失点</span><b>${tr.ga}</b><small>1試合 ${(tr.ga/tr.n).toFixed(2)}</small></div>
      <div class="tg"><span>無失点試合</span><b>${tr.cs}</b><small>試合</small></div>
      ${big?`<div class="tg"><span>最多得点差の勝利</span><b>${big.gf}-${big.ga}</b><small>vs ${esc(big.opp)}</small></div>`:""}
      ${attL.length?`<div class="tg"><span>ホーム平均観客数</span><b>${nf(Math.round(attL.reduce((a,m)=>a+m.att,0)/attL.length))}</b><small>人</small></div>`:""}
    </div>`:""}
    <h2 class="h2">PLAYERS</h2>
    ${avail.length?`<div class="tabs" id="st-tabs">${avail.map(([kk,l])=>`<button class="tab${kk===k?" on":""}" data-k="${kk}">${l}</button>`).join("")}</div>
      <div class="rk">${R.map((r,i)=>`<a class="rk-r" href="#player/${encodeURIComponent(r.name)}"><div class="rk-n">${i+1}</div>${face(r.name)}
        <div><b>${esc(r.name)}</b><small>${esc(r.pos||(profile(r.name)||{}).pos||"")}${r.apps?`・${r.apps}試合`:""}</small></div>
        <div class="rk-v">${k==="rating"?r[k].toFixed(2):r[k]}<small>${u}</small></div></a>`).join("")}</div>
      <p class="note">${src}集計${k==="rating"?"（出場数が少ない選手は除いています）":""}</p>`
      : empty("選手成績シート、または試合シートの得点者を入れると、ランキングが出ます。")}</div>`;
}
function bStats(){ bindSel("st-season", v=>{ ST.stSeason=v; render(); }); document.querySelectorAll("#st-tabs .tab").forEach(b=>b.onclick=()=>{ ST.rk=b.dataset.k; render(); }); }

/* ---------- TRANSFER ---------- */
function trRow(t){
  const dir=trDir(t.kind);
  return `<div class="tr">${face(t.name)}
    <div style="min-width:0"><span class="tr-k ${dir}">${esc(t.kind)}</span><a href="#player/${encodeURIComponent(t.name)}"><b>${esc(t.name)}</b></a>
      <div class="tr-c">${t.club?`${dir==="out"?"→":"←"} ${logo(t.club)}<span>${esc(t.club)}</span>`:""}<span style="color:var(--ink3)">${fmtD(t.date)}</span></div>
      ${t.memo?`<div class="tr-c">${esc(t.memo)}</div>`:""}</div>
    <div class="tr-f">${t.fee?money(t.fee):""}<small>${esc(t.season)}</small></div></div>`;
}
function vTransfer(){
  const s=ST.trSeason;
  const T=D.trans.filter(t=>!s||t.season===s).sort((a,b)=>(b.date?b.date:0)-(a.date?a.date:0));
  const In=T.filter(t=>trDir(t.kind)==="in"), Out=T.filter(t=>trDir(t.kind)==="out"), Etc=T.filter(t=>trDir(t.kind)==="etc");
  const spend=In.reduce((a,t)=>a+(t.fee||0),0), earn=Out.reduce((a,t)=>a+(t.fee||0),0), net=earn-spend;
  const top=D.trans.filter(t=>t.fee).sort((a,b)=>b.fee-a.fee).slice(0,5);
  return `<div class="wrap" style="max-width:820px">${head("TRANSFER")}
    <div class="toolbar">${seasonSel("tr-season", s, true)}</div>
    ${T.length?`<div class="chips"><span class="chip">支出 <b>${money(spend)||0}</b></span><span class="chip">収入 <b>${money(earn)||0}</b></span>
      <span class="chip">収支 <b>${net>0?"+":net<0?"−":""}${money(Math.abs(net))||0}</b></span></div>`:""}
    <h2 class="h2">IN｜加入 ${In.length?`（${In.length}人）`:""}</h2>${In.length?`<div class="tr-list">${In.map(trRow).join("")}</div>`:empty("加入はまだありません。")}
    <h2 class="h2">OUT｜退団 ${Out.length?`（${Out.length}人）`:""}</h2>${Out.length?`<div class="tr-list">${Out.map(trRow).join("")}</div>`:empty("退団はまだありません。")}
    ${Etc.length?`<h2 class="h2">契約更新など</h2><div class="tr-list">${Etc.map(trRow).join("")}</div>`:""}
    ${!s&&top.length?`<h2 class="h2">歴代の高額移籍</h2><div class="tr-list">${top.map(trRow).join("")}</div>`:""}</div>`;
}
function bTransfer(){ bindSel("tr-season", v=>{ ST.trSeason=v; render(); }); }

/* ---------- HISTORY ---------- */
function vHistory(){
  const titles=[]; D.seasons.forEach(S=>{ if(/^1$/.test(S.rank)) titles.push([S.league||"リーグ",S.season]);
    [["国内カップ",S.cup],["リーグカップ",S.lcup],["国際大会",S.intl]].forEach(([k,v])=>{ if(/^優勝/.test(v||"")) titles.push([k,S.season]); }); });
  const tc={}; titles.forEach(([k,s])=>(tc[k]=tc[k]||[]).push(s));
  const seasons=[...D.seasonList].sort();
  const ts=ST.tblSeason && D.seasonList.includes(ST.tblSeason) ? ST.tblSeason : (D.table.length? [...new Set(D.table.map(r=>r.season))].sort().reverse()[0] : null);
  const comps=[...new Set(D.table.filter(r=>r.season===ts).map(r=>r.comp))];
  const tcmp= comps.includes(ST.tblComp) ? ST.tblComp : comps[0];
  const tb=D.table.filter(r=>r.season===ts && r.comp===tcmp).sort((a,b)=>(a.rank||99)-(b.rank||99));
  const info=[["クラブ名",clubName()],["ホームスタジアム",D.conf["ホームスタジアム"]],["監督",D.conf["監督名"]],["最初のシーズン",D.conf["最初のシーズン"]]].filter(([,v])=>v);
  return `<div class="wrap" style="max-width:900px">${head("HISTORY")}
    ${info.length?`<dl class="pd-prof" style="margin-bottom:6px">${info.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
    <h2 class="h2">TITLES｜獲得タイトル</h2>
    ${Object.keys(tc).length?`<div class="ti-grid">${Object.keys(tc).map(k=>`<div class="ti"><b>${tc[k].length}<small>回</small></b><div>🏆 ${esc(k)}</div><p>${esc(tc[k].join("、"))}</p></div>`).join("")}</div>`:empty("まだタイトルはありません。")}
    <h2 class="h2">SEASONS｜歴代成績</h2>
    ${seasons.length?`<div class="tw"><table class="t"><thead><tr><th>シーズン</th><th class="l">リーグ</th><th>順位</th><th>勝-分-敗</th><th>得失点</th><th>国内カップ</th><th>リーグカップ</th><th>国際大会</th><th class="l">主将</th></tr></thead><tbody>
      ${seasons.map(s=>{ const S=seasonInfo(s)||{}, r=record(ofSeason(s)), rk=myRank(s);
        return `<tr><th>${esc(s)}</th><td class="l">${esc(S.league||leagueName(s))}</td><td${rk==="1"?' class="gold"':""}>${esc(rk)}</td><td>${r.n?`${r.w}-${r.d}-${r.l}`:""}</td><td>${r.n?`${r.gf}-${r.ga}`:""}</td>
          <td${/^優勝/.test(S.cup||"")?' class="gold"':""}>${esc(S.cup||"")}</td><td${/^優勝/.test(S.lcup||"")?' class="gold"':""}>${esc(S.lcup||"")}</td><td${/^優勝/.test(S.intl||"")?' class="gold"':""}>${esc(S.intl||"")}</td>
          <td class="l">${S.cap?`<a href="#player/${encodeURIComponent(S.cap)}">${esc(S.cap)}</a>`:""}</td></tr>`; }).join("")}</tbody></table></div>`:empty("まだシーズンの記録がありません。")}
    ${D.seasons.filter(S=>S.comment).length?`<div class="tr-list" style="margin-top:12px">${D.seasons.filter(S=>S.comment).slice().reverse().map(S=>`<div class="md-box"><h3>${esc(S.season)}</h3>${esc(S.comment)}</div>`).join("")}</div>`:""}
    <h2 class="h2">STANDINGS｜順位表</h2>
    ${ts?`<div class="toolbar"><select class="sel" id="hs-season">${[...new Set(D.table.map(r=>r.season))].sort().reverse().map(s=>`<option${s===ts?" selected":""}>${esc(s)}</option>`).join("")}</select>
      ${comps.length>1?`<select class="sel" id="hs-comp">${comps.map(c=>`<option${c===tcmp?" selected":""}>${esc(c)}</option>`).join("")}</select>`:""}</div>
      <div class="tw"><table class="t"><thead><tr><th>順位</th><th class="l">クラブ</th><th>試合</th><th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th><th>得失点</th><th>勝点</th></tr></thead><tbody>
      ${tb.map(r=>{ const me=isMe(r.club); return `<tr class="${me?"me":""}"><th>${r.rank??""}</th><td class="l"><div class="t-club">${logo(me?clubName():r.club)}${esc(me?clubName():r.club)}</div></td>
        <td>${r.p??""}</td><td>${r.w??""}</td><td>${r.d??""}</td><td>${r.l??""}</td><td>${r.gf??""}</td><td>${r.ga??""}</td><td>${r.gf!=null&&r.ga!=null?(r.gf-r.ga>0?"+":"")+(r.gf-r.ga):""}</td><td><b>${r.pts??""}</b></td></tr>`; }).join("")}</tbody></table></div>`
      : empty("順位表シートに入れると、ここに最終順位表が出ます。")}</div>`;
}
function bHistory(){ bindSel("hs-season", v=>{ ST.tblSeason=v; ST.tblComp=null; render(); }); bindSel("hs-comp", v=>{ ST.tblComp=v; render(); }); }

/* =====================================================================
   ルーティング（#match/3 のような直リンク・戻るボタン対応）
   ===================================================================== */
const ROUTES = {
  home:     [vHome, null, "HOME"],
  news:     [vNews, bNews, "NEWS", vNewsDetail],
  match:    [vMatch, bMatch, "MATCH", vMatchDetail],
  players:  [vPlayers, bPlayers, "PLAYERS"],
  player:   [null, null, "PLAYERS", vPlayerDetail],
  stats:    [vStats, bStats, "STATS"],
  transfer: [vTransfer, bTransfer, "TRANSFER"],
  history:  [vHistory, bHistory, "HISTORY"]
};
function parseHash(){ const h=decodeURIComponent((location.hash||"").replace(/^#/,"")); const i=h.indexOf("/"); return i<0 ? {page:h||"home", arg:null} : {page:h.slice(0,i), arg:h.slice(i+1)}; }
let lastKey="";
function render(){
  let {page,arg}=parseHash(); if(!ROUTES[page]) { page="home"; arg=null; }
  const R=ROUTES[page];
  const nav = page==="player" ? "players" : page;
  document.querySelectorAll("#hd-nav a").forEach(a=>a.classList.toggle("on", a.dataset.nav===nav));
  const view=$("view");
  if(!D.loaded){ view.innerHTML=`<div class="wrap"><div class="loading">読み込み中…</div></div>`; return; }
  if(D.err){ view.innerHTML=`<div class="wrap">${empty(D.err)}</div>`; return; }
  const detail = arg!=null && R[3];
  view.innerHTML = detail ? R[3](arg) : (R[0]?R[0]():"");
  if(!detail && R[1]) R[1]();
  let title=R[2];
  if(detail){ const h=view.querySelector("h1,.pd-name,.md-comp"); if(h) title=h.textContent.trim(); }
  document.title = `${clubName()} | ${title}`;
  const key=page+"/"+(arg||""); if(key!==lastKey){ window.scrollTo(0,0); lastKey=key; }
  const nb=document.querySelector("#hd-nav a.on"); if(nb) nb.scrollIntoView({block:"nearest", inline:"center"});
}
window.addEventListener("hashchange", render);
$("ft-year").textContent=new Date().getFullYear();
render();
loadAll().catch(e=>{ console.error(e); D.err="読み込み中にエラーが起きました。"; D.loaded=true; }).finally(render);
