import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();
const today = new Date().toISOString().split("T")[0];

const CATEGORIES = {
  "shikaku-hikaku":      "資格・講座比較レビュー",
  "dokugaku-vs-tsushin": "独学 vs 通信講座",
  "shakaijin-study":     "社会人の学習法",
  "elearning":           "eラーニング紹介",
  "zaitaku-shikaku":     "在宅で取れる資格",
};

const categoryList = Object.entries(CATEGORIES)
  .map(([slug, label]) => `  - ${slug}: ${label}`)
  .join("\n");

const HERO_IMAGES = [
  '../../../assets/blog-placeholder-1.jpg',
  '../../../assets/blog-placeholder-2.jpg',
  '../../../assets/blog-placeholder-3.jpg',
  '../../../assets/blog-placeholder-4.jpg',
  '../../../assets/blog-placeholder-5.jpg',
];
const heroImage = HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 2500,
  messages: [{
    role: "user",
    content: `あなたはオンライン学習・資格講座の専門メディアのライターです。
日本語で800〜1000文字のブログ記事を1本書いてください。

以下のカテゴリーから最も適切な1つを選んでください：
${categoryList}

出力形式（この形式のみで出力し、余分な文章は一切書かないこと）：

CATEGORY_SLUG: [カテゴリーのslugをそのまま記入]
URL_SLUG: [記事内容を表す英語slug、小文字・ハイフン区切り・3〜5単語]
---
title: '記事タイトル（日本語）'
description: '記事の説明（120文字以内）'
pubDate: '${today}'
heroImage: '[HERO_IMAGE]'
category: '[CATEGORY_SLUGと同じ値]'
---

記事本文（Markdown形式）
- 本文の最初の見出しはh2（##）から始めること（h1は使わない）
- h2・h3を使って内容を構造化すること`,
  }],
});

const text = response.content[0].text.trim();
const lines = text.split("\n");

const categorySlug = lines[0].replace("CATEGORY_SLUG:", "").trim();
const urlSlug = lines[1].replace("URL_SLUG:", "").trim();
const content = lines.slice(2).join("\n").trim().replace("'[HERO_IMAGE]'", `'${heroImage}'`);

if (!CATEGORIES[categorySlug]) {
  throw new Error(`Unknown category: "${categorySlug}". Valid: ${Object.keys(CATEGORIES).join(", ")}`);
}
if (!urlSlug || !/^[a-z0-9-]+$/.test(urlSlug)) {
  throw new Error(`Invalid URL slug: "${urlSlug}"`);
}

const dir = `src/content/blog/${categorySlug}`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filename = `${dir}/${urlSlug}.md`;
fs.writeFileSync(filename, content);
console.log(`記事を生成しました: ${filename}`);
console.log(`URL: /${categorySlug}/${urlSlug}/`);
