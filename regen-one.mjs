import fs from 'fs';

const key = process.env.OPENAI_API_KEY;
const outputPath = 'public/images/articles/fp2-dokugaku-vs-tsushin-kouza-body-1.jpg';
const query = 'young woman business casual sitting cafe window morning light contemplating career';

const prompt = `A professional, photo-realistic image for a Japanese online education website. Scene: ${query}. Focus on people and workspace environments — avoid showing books, screens, or any objects with visible text. Absolutely no text, letters, characters, or writing of any kind anywhere in the image. No watermarks, no logos. Warm natural lighting, clean and inspiring atmosphere.`;

console.log('🎨 再生成中...');
const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1024', quality: 'medium' }),
});
if (!res.ok) { const e = await res.json(); console.error(e); process.exit(1); }
const data = await res.json();
fs.writeFileSync(outputPath, Buffer.from(data.data[0].b64_json, 'base64'));
console.log('✅ 生成完了:', outputPath);
