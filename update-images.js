/**
 * 既存記事にUnsplash画像を追加するスクリプト
 * 使い方: node --env-file=.env update-images.js
 */
import fs from "fs";
import path from "path";

const IMAGES_PUBLIC_DIR = "public/images/articles";

async function downloadUnsplashImage(query, outputPath) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY が設定されていません。.env ファイルを確認してください。");

  const apiRes = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );
  if (!apiRes.ok) throw new Error(`Unsplash API エラー: ${apiRes.status} ${await apiRes.text()}`);
  const data = await apiRes.json();

  const imgRes = await fetch(data.urls.regular);
  if (!imgRes.ok) throw new Error("画像ダウンロード失敗");

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(await imgRes.arrayBuffer()));

  console.log(`  📷 保存: ${outputPath}`);
  console.log(`     Photo by ${data.user.name} on Unsplash`);
  return true;
}

function insertBodyImages(content, slug) {
  const lines = content.split("\n");
  const out = [];
  let h2Count = 0;
  let imgIdx = 1;

  for (const line of lines) {
    out.push(line);
    if (line.startsWith("## ")) {
      h2Count++;
      if (h2Count >= 2 && h2Count % 2 === 0) {
        const altText = line.replace(/^## /, "");
        out.push("");
        out.push(`![${altText}](/images/articles/${slug}-body-${imgIdx}.jpg)`);
        out.push("");
        imgIdx++;
      }
    }
  }
  return { content: out.join("\n"), bodyImageCount: imgIdx - 1 };
}

// ── 対象記事の定義 ──────────────────────────────────────────────────────────────
const ARTICLES = [
  {
    file: "src/content/blog/shakaijin-study/shikaku-shutoku-tips.md",
    slug: "shikaku-shutoku-tips",
    heroQuery: "adult professional studying certification career",
    bodyQueries: [
      "time management planning schedule study",
      "online learning laptop e-learning course",
    ],
  },
];

// ── 実行 ────────────────────────────────────────────────────────────────────────
for (const article of ARTICLES) {
  console.log(`\n🔄 更新中: ${article.file}`);
  let md = fs.readFileSync(article.file, "utf-8");

  // Hero image
  console.log(`\n🖼  ヒーロー画像: "${article.heroQuery}"`);
  const heroPath = `${IMAGES_PUBLIC_DIR}/${article.slug}-hero.jpg`;
  await downloadUnsplashImage(article.heroQuery, heroPath);
  const heroPublic = `/images/articles/${article.slug}-hero.jpg`;

  // Update heroImage in frontmatter
  md = md.replace(
    /heroImage:.*$/m,
    `heroImage: '${heroPublic}'`
  );

  // Body images
  const { content: newContent, bodyImageCount } = insertBodyImages(md, article.slug);

  for (let i = 1; i <= Math.min(bodyImageCount, article.bodyQueries.length); i++) {
    const q = article.bodyQueries[i - 1];
    console.log(`\n🖼  本文画像 ${i}: "${q}"`);
    await downloadUnsplashImage(q, `${IMAGES_PUBLIC_DIR}/${article.slug}-body-${i}.jpg`);
  }

  fs.writeFileSync(article.file, newContent);
  console.log(`\n✅ 完了: ${article.file}`);
}

console.log("\n🚀 git add -A && git commit -m 'Add Unsplash images to articles' && git push でデプロイしてください");
