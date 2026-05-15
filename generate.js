import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic();
const today = new Date().toISOString().split("T")[0];

const CATEGORIES = {
  "shikaku-hikaku":      "資格・講座比較レビュー",
  "dokugaku-vs-tsushin": "独学 vs 通信講座",
  "shakaijin-study":     "社会人の学習法",
  "elearning":           "eラーニング紹介",
  "zaitaku-shikaku":     "在宅で取れる資格",
};

// English keywords for Unsplash image search per category
const CATEGORY_KEYWORDS = {
  "shikaku-hikaku":      "qualification certification exam test",
  "dokugaku-vs-tsushin": "self study online course learning",
  "shakaijin-study":     "adult learning career professional study",
  "elearning":           "e-learning digital education laptop",
  "zaitaku-shikaku":     "home office remote study desk",
};

const IMAGES_PUBLIC_DIR = "public/images/articles";

// Download an image from Unsplash and save it locally
async function downloadUnsplashImage(query, outputPath) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn("  ⚠ UNSPLASH_ACCESS_KEY が未設定のため画像をスキップします");
    return false;
  }
  try {
    const apiRes = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!apiRes.ok) {
      console.warn(`  ⚠ Unsplash API エラー: ${apiRes.status} ${await apiRes.text()}`);
      return false;
    }
    const data = await apiRes.json();
    const imgUrl = data.urls.regular; // ~1080px wide JPEG

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) { console.warn("  ⚠ 画像ダウンロード失敗"); return false; }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(await imgRes.arrayBuffer()));

    console.log(`  📷 保存: ${outputPath}`);
    console.log(`     Photo by ${data.user.name} on Unsplash`);
    return true;
  } catch (err) {
    console.warn(`  ⚠ 画像取得エラー: ${err.message}`);
    return false;
  }
}

// Insert body images after every 2nd h2 heading
function insertBodyImages(content, slug, hasImages) {
  if (!hasImages) return content;
  const lines = content.split("\n");
  const out = [];
  let h2Count = 0;
  let imgIdx = 1;

  for (const line of lines) {
    out.push(line);
    if (line.startsWith("## ")) {
      h2Count++;
      // Insert image after the 2nd h2, then every 2nd after that
      if (h2Count >= 2 && h2Count % 2 === 0) {
        const imgPath = `/images/articles/${slug}-body-${imgIdx}.jpg`;
        const altText = line.replace(/^## /, "");
        out.push("");
        out.push(`![${altText}](${imgPath})`);
        out.push("");
        imgIdx++;
      }
    }
  }
  return out.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const categoryList = Object.entries(CATEGORIES)
  .map(([slug, label]) => `  - ${slug}: ${label}`)
  .join("\n");

console.log("📝 記事を生成中...");
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 3000,
  messages: [{
    role: "user",
    content: `あなたはオンライン学習・資格講座の専門メディアのライターです。
日本語で1000〜1200文字のブログ記事を1本書いてください。

以下のカテゴリーから最も適切な1つを選んでください：
${categoryList}

出力形式（この形式のみで出力し、余分な文章は一切書かないこと）：

CATEGORY_SLUG: [カテゴリーのslugをそのまま記入]
URL_SLUG: [記事内容を表す英語slug、小文字・ハイフン区切り・3〜5単語]
IMAGE_QUERIES: [ヒーロー画像用英語クエリ]|[本文画像1用英語クエリ]|[本文画像2用英語クエリ]
---
title: '記事タイトル（日本語）'
description: '記事の説明（120文字以内）'
pubDate: '${today}'
heroImage: 'HERO_IMAGE'
category: '[CATEGORY_SLUGと同じ値]'
---

記事本文（Markdown形式）
- 本文にはh1（#）は含めないこと。記事の最初の見出しはh2（##）から始めること
- h2を4〜6個使って内容を構造化すること
- h3も適宜使うこと

IMAGE_QUERIESについて：
- | で区切った英語フレーズ（各3〜5語）
- ヒーロー画像は記事全体のテーマを表す
- 本文画像は記事の内容に合った具体的なシーン（例: "student studying notes desk", "online video lecture laptop"）`,
  }],
});

const text = response.content[0].text.trim();
const lines = text.split("\n");

// Parse header lines
const categorySlug = lines[0].replace("CATEGORY_SLUG:", "").trim();
const urlSlug      = lines[1].replace("URL_SLUG:", "").trim();
const imageQueries = lines[2].replace("IMAGE_QUERIES:", "").trim().split("|").map(q => q.trim());

// Validate
if (!CATEGORIES[categorySlug]) {
  throw new Error(`Unknown category: "${categorySlug}". Valid: ${Object.keys(CATEGORIES).join(", ")}`);
}
if (!urlSlug || !/^[a-z0-9-]+$/.test(urlSlug)) {
  throw new Error(`Invalid URL slug: "${urlSlug}"`);
}

// Content starts after the header lines
const rawContent = lines.slice(3).join("\n").trim();

// ── Download images ───────────────────────────────────────────────────────────
const baseKeyword = CATEGORY_KEYWORDS[categorySlug];
const heroQuery   = imageQueries[0] ?? baseKeyword;

if (!fs.existsSync(IMAGES_PUBLIC_DIR)) fs.mkdirSync(IMAGES_PUBLIC_DIR, { recursive: true });

console.log(`\n🖼  ヒーロー画像を取得中: "${heroQuery}"`);
const heroPath    = `${IMAGES_PUBLIC_DIR}/${urlSlug}-hero.jpg`;
const heroOk      = await downloadUnsplashImage(heroQuery, heroPath);
const heroPublic  = heroOk ? `/images/articles/${urlSlug}-hero.jpg` : "";

// Download body images (queries[1], queries[2], ...)
const bodyQueryCount = Math.max(0, imageQueries.length - 1);
const bodyImgOk = [];
for (let i = 0; i < bodyQueryCount; i++) {
  const q = imageQueries[i + 1] ?? baseKeyword;
  console.log(`\n🖼  本文画像 ${i + 1} を取得中: "${q}"`);
  const ok = await downloadUnsplashImage(q, `${IMAGES_PUBLIC_DIR}/${urlSlug}-body-${i + 1}.jpg`);
  bodyImgOk.push(ok);
}
const anyBodyImages = bodyImgOk.some(Boolean);

// ── Build final content ───────────────────────────────────────────────────────
let finalContent = rawContent.replace("'HERO_IMAGE'", heroPublic ? `'${heroPublic}'` : "");

// Insert body images into the markdown
finalContent = insertBodyImages(finalContent, urlSlug, anyBodyImages);

// ── Write file ────────────────────────────────────────────────────────────────
const dir = `src/content/blog/${categorySlug}`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filename = `${dir}/${urlSlug}.md`;
fs.writeFileSync(filename, finalContent);

console.log(`\n✅ 記事を生成しました: ${filename}`);
console.log(`   URL: /${categorySlug}/${urlSlug}/`);
if (heroPublic) console.log(`   ヒーロー画像: ${heroPublic}`);
