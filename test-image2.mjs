import fs from 'fs';

const key = process.env.OPENAI_API_KEY;

const prompt = `
Create a clean, professional infographic for a Japanese education website.

Title: 簿記2級の勉強方法を比較

Layout: A comparison card with 3 columns side by side on a white background.

Column 1 — 独学
Icon: book
費用: 3,000〜8,000円
自由度: ★★★
サポート: なし
こんな人に: 3級取得済みで自己管理できる人

Column 2 — 通信講座 (highlighted with light blue background as "人気No.1")
Icon: laptop
費用: 20,000〜60,000円
自由度: ★★☆
サポート: 質問対応あり
こんな人に: 隙間時間に動画で学びたい人

Column 3 — 通学スクール
Icon: school building
費用: 60,000〜120,000円
自由度: ★☆☆
サポート: 講師に直接質問
こんな人に: 強制力がないと続かない人

Design style: Modern, minimal, clean Japanese design. Use Japanese text exactly as written above. Soft colors (white, light blue accent). No decorative elements that obscure text. Clear readable fonts. Add a small footer: ※費用は概算です。各社公式サイトをご確認ください。
`;

console.log('🎨 gpt-image-2 でインフォグラフィックを生成中...');

const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-2',
    prompt,
    n: 1,
    size: '1536x1024',
    quality: 'high',
  }),
});

if (!res.ok) {
  const err = await res.json();
  console.error('❌ エラー:', res.status, err.error?.message);
  process.exit(1);
}

const data = await res.json();
const b64 = data.data[0].b64_json;
fs.writeFileSync('test-infographic.jpg', Buffer.from(b64, 'base64'));
console.log('✅ 生成完了: test-infographic.jpg');
