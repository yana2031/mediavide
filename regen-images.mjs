import fs from 'fs';
import path from 'path';

const IMAGES_DIR = 'public/images/articles';

async function generateAiImage(query, outputPath, size = '1024x1024') {
  const key = process.env.OPENAI_API_KEY;
  const prompt = `A professional, photo-realistic image for a Japanese online education website. Scene: ${query}. Focus on people and workspace environments — avoid showing books, screens, or any objects with visible text. Absolutely no text, letters, characters, or writing of any kind anywhere in the image. No watermarks, no logos. Warm natural lighting, clean and inspiring atmosphere.`;

  const apiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality: 'medium' }),
  });

  if (!apiRes.ok) {
    const err = await apiRes.json();
    console.warn(`  ⚠ エラー: ${apiRes.status}`, err.error?.message ?? '');
    return false;
  }
  const data = await apiRes.json();
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(data.data[0].b64_json, 'base64'));
  console.log(`  🎨 生成: ${outputPath}`);
  return true;
}

const articles = [
  {
    slug: 'shikaku-shutoku-tips',
    images: [
      { file: 'hero',   size: '1536x1024', query: 'focused adult professional studying at desk evening lamp warm light' },
      { file: 'body-1', size: '1024x1024', query: 'busy office worker commuting train morning study notes' },
      { file: 'body-2', size: '1024x1024', query: 'adult woman smiling confident at desk achieving goal' },
      { file: 'body-3', size: '1024x1024', query: 'japanese professional man working late studying home desk' },
    ],
  },
  {
    slug: 'shakaijin-boki2-study-method',
    images: [
      { file: 'hero',   size: '1536x1024', query: 'focused adult man studying at home desk night lamp determined' },
      { file: 'body-1', size: '1024x1024', query: 'person taking notes at desk morning coffee focused studying' },
      { file: 'body-2', size: '1024x1024', query: 'adult woman using smartphone learning online at home sofa' },
    ],
  },
];

for (const article of articles) {
  console.log(`\n📄 ${article.slug}`);
  for (const img of article.images) {
    const outputPath = `${IMAGES_DIR}/${article.slug}-${img.file}.jpg`;
    console.log(`  🖼  ${img.file}: "${img.query}"`);
    await generateAiImage(img.query, outputPath, img.size);
  }
}

console.log('\n✅ 全画像の差し替え完了');
