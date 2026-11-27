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
  gr:    ["選手の推移", 8],
  tr:    ["移籍", 9],
  li:    ["クラブ", 14],
  aw:    ["個人タイトル", 13],
  ox:    ["他クラブの試合", 17],
  inj:   ["負傷", 18]
};
const DEFAULT_CLUB = "Principale";
const DEMO = /[?&]demo\b/.test(location.search);
const IMG_EXT = ["png", "webp", "jpg"];
