import fs from 'fs';

const key = process.env.OPENAI_API_KEY;
const IMAGES_DIR = 'public/images/articles';

async function generateInfographic(prompt, outputPath) {
  if (fs.existsSync(outputPath)) {
    console.log(`  ✅ スキップ（既存）: ${outputPath}`);
    return true;
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1536x1024', quality: 'high' }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.warn(`  ⚠ エラー: ${res.status}`, err.error?.message ?? '');
    return false;
  }
  const data = await res.json();
  fs.writeFileSync(outputPath, Buffer.from(data.data[0].b64_json, 'base64'));
  console.log(`  📊 生成: ${outputPath}`);
  return true;
}

function insertInfographic(mdPath, slug) {
  let content = fs.readFileSync(mdPath, 'utf-8');
  if (content.includes(`${slug}-info-1.jpg`)) {
    console.log(`  ✅ スキップ（既に挿入済み）`);
    return;
  }
  const lines = content.split('\n');
  let lastTableLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|')) lastTableLine = i;
  }
  if (lastTableLine === -1) {
    console.warn(`  ⚠ テーブルが見つかりません`);
    return;
  }
  let insertAt = lastTableLine + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
  if (insertAt < lines.length && lines[insertAt].startsWith('※')) insertAt++;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const newContent = [...before, '', `![](/images/articles/${slug}-info-1.jpg)`, '', ...after].join('\n');
  fs.writeFileSync(mdPath, newContent);
  console.log(`  📝 挿入: ${mdPath}`);
}

const articles = [
  {
    slug: 'shikaku-shutoku-tips',
    mdPath: 'src/content/blog/shakaijin-study/shikaku-shutoku-tips.md',
    prompt: `Create a clean, professional comparison infographic for a Japanese education website.

Title: 教材・勉強法の選び方ガイド

Layout: 4 cards in a 2x2 grid on a white background.

Card 1 — 市販テキスト（独学）
費用: 3,000〜8,000円程度
自由度: ★★★
サポート: なし
こんな人に: 自己管理できる・費用を抑えたい

Card 2 — 通信講座（動画あり）  [light blue highlight, label 人気]
費用: 20,000〜60,000円程度
自由度: ★★☆
サポート: 質問対応あり
こんな人に: 動画で理解したい・隙間時間活用

Card 3 — 通学スクール
費用: 60,000〜120,000円程度
自由度: ★☆☆
サポート: 講師に直接質問可
こんな人に: 強制力がないと動けない

Card 4 — アプリ中心（過去問特化）
費用: 無料〜数千円程度
自由度: ★★★
サポート: なし
こんな人に: 通勤時間を活用したい

Design: Modern minimal clean Japanese design. White background, soft blue and orange accents. All Japanese text exactly as written. Clear readable fonts.`,
  },
  {
    slug: 'shakaijin-boki2-study-method',
    mdPath: 'src/content/blog/shakaijin-study/shakaijin-boki2-study-method.md',
    prompt: `Create a clean, professional comparison infographic for a Japanese education website.

Title: 簿記2級の勉強方法を比較

Layout: 3 columns side by side on a white background.

Column 1 — 独学（市販テキスト）
費用: 3,000〜8,000円程度
スケジュール自由度: ★★★
サポート体制: なし
向いている人: 3級取得済みで自己管理できる人

Column 2 — 通信講座（動画あり） [light blue highlight, label 人気No.1]
費用: 20,000〜60,000円程度
スケジュール自由度: ★★☆
サポート体制: 質問対応あり
向いている人: 隙間時間に学びたい・映像で理解したい人

Column 3 — 通学（資格スクール）
費用: 60,000〜120,000円程度
スケジュール自由度: ★☆☆
サポート体制: 講師に直接質問できる
向いている人: 強制力がないと続かない人

Footer: ※費用は概算です。各社公式サイトをご確認ください。

Design: Modern minimal clean Japanese design. White background, soft blue accent. All Japanese text exactly as written.`,
  },
  {
    slug: 'fp2-dokugaku-vs-tsushin-kouza',
    mdPath: 'src/content/blog/dokugaku-vs-tsushin/fp2-dokugaku-vs-tsushin-kouza.md',
    prompt: `Create a clean, professional comparison infographic for a Japanese education website.

Title: FP2級 学習方法・費用比較

Layout: 4 columns on a white background.

Column 1 — 独学
費用: 5,000〜15,000円（書籍代）
学習スタイル: 自己管理・紙テキスト中心
質問サポート: なし
スキマ学習: 低〜中
向いている人: 自律型・既存知識あり

Column 2 — スタディング [light blue highlight, label コスパ◎]
費用: 約17,800円〜
学習スタイル: スマホ動画・Web問題集
質問サポート: あり（AIチャット等）
スキマ学習: 高
向いている人: 時間が細切れな人

Column 3 — フォーサイト
費用: 約32,800円〜
学習スタイル: テキスト＋動画
質問サポート: あり
スキマ学習: 中〜高
向いている人: バランス重視

Column 4 — ユーキャン
費用: 約64,000円〜
学習スタイル: テキスト＋添削
質問サポート: あり
スキマ学習: 中
向いている人: じっくり取り組める人

Footer: ※費用・内容は変更される場合があります。各公式サイトで最新情報をご確認ください。

Design: Modern minimal clean Japanese design. White background, blue and orange accents. All Japanese text exactly as written.`,
  },
];

for (const article of articles) {
  console.log(`\n📄 ${article.slug}`);
  const outputPath = `${IMAGES_DIR}/${article.slug}-info-1.jpg`;
  const ok = await generateInfographic(article.prompt, outputPath);
  if (ok) insertInfographic(article.mdPath, article.slug);
}

console.log('\n✅ 完了');
