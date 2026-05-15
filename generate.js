import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic();
const today = new Date().toISOString().split("T")[0];
const year  = new Date().getFullYear();

const CATEGORIES = {
  "shikaku-hikaku":      "資格・講座比較レビュー",
  "dokugaku-vs-tsushin": "独学 vs 通信講座",
  "shakaijin-study":     "社会人の学習法",
  "elearning":           "eラーニング紹介",
  "zaitaku-shikaku":     "在宅で取れる資格",
};

const CATEGORY_KEYWORDS = {
  "shikaku-hikaku":      "qualification certification exam test",
  "dokugaku-vs-tsushin": "self study online course learning",
  "shakaijin-study":     "adult learning career professional study",
  "elearning":           "e-learning digital education laptop",
  "zaitaku-shikaku":     "home office remote study desk",
};

const IMAGES_PUBLIC_DIR = "public/images/articles";

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
      console.warn(`  ⚠ Unsplash API エラー: ${apiRes.status}`);
      return false;
    }
    const data = await apiRes.json();
    const imgRes = await fetch(data.urls.regular);
    if (!imgRes.ok) return false;

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

function insertBodyImages(content, slug, hasImages) {
  if (!hasImages) return content;
  const lines = content.split("\n");
  const out = [];
  let h2Count = 0;
  let imgIdx = 1;

  for (const line of lines) {
    out.push(line);
    if (line.startsWith("## ") && !line.includes("よくある質問") && !line.includes("まとめ")) {
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
  return out.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const categoryList = Object.entries(CATEGORIES)
  .map(([slug, label]) => `  - ${slug}: ${label}`)
  .join("\n");

console.log("📝 記事を生成中...");

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4000,
  messages: [{
    role: "user",
    content: `あなたは日本のSEOに精通した、オンライン学習・資格講座の専門メディアのライターです。
検索上位を狙える、読者に刺さる日本語記事を1本書いてください。

【ターゲット読者】
20〜40代の社会人。忙しく働きながらも、転職・昇進・スキルアップのために資格取得を目指している。
「本当に合格できるか不安」「時間がない」「どの講座を選べばいいかわからない」という悩みを持つ。

【カテゴリー選択】以下から最も適切な1つを選んでください：
${categoryList}

【SEO要件】
- タイトル：検索意図を含み、「【${year}年版】」「徹底解説」「完全ガイド」「失敗しない」など日本で効果的なパワーワードを入れる
- H2見出し：Googleで実際に検索されそうな具体的フレーズにする（例：「通信講座と独学どっちが安い？費用を徹底比較」）
- 本文：具体的な数字・期間・金額を必ず入れる。ペルソナの具体例（「30代営業職のAさんの場合〜」）を1つ以上入れる

【記事構成の必須要素】
1. 冒頭に「この記事でわかること」のblockquote（> 記法）
2. 悩み・問題提起のリード文（共感を得る）
3. 本文H2を4〜6個（各300〜400文字）
4. 途中に比較表（Markdownテーブル）を1つ以上
5. 「## よくある質問（FAQ）」セクション（### Q: 〜？ / A: 〜の形式で3問）
6. 「## まとめ」セクション（箇条書きで要点整理）

【出力形式】この形式のみで出力し、余分な説明は一切書かないこと：

CATEGORY_SLUG: [選んだカテゴリーのslug]
URL_SLUG: [記事内容を表す英語slug、小文字・ハイフン区切り・3〜5単語]
IMAGE_QUERIES: [ヒーロー画像用英語クエリ3〜5語]|[本文画像1用英語クエリ]|[本文画像2用英語クエリ]
---
title: '記事タイトル（日本語・50文字以内）'
description: '記事の説明（検索結果に表示される120文字以内の要約）'
pubDate: '${today}'
heroImage: 'HERO_IMAGE'
category: '[CATEGORY_SLUGと同じ値]'
---

> **📋 この記事でわかること**
>
> - わかること1
> - わかること2
> - わかること3

[リード文：ターゲット読者の悩みに共感する2〜3段落]

## [H2見出し1：検索されるフレーズ]

[本文300〜400文字、具体的数字を含む]

## [H2見出し2]

[本文]

| 項目 | 選択肢A | 選択肢B |
|------|---------|---------|
| 〜 | 〜 | 〜 |

[残りのH2セクション...]

## よくある質問（FAQ）

### Q: [よく検索される質問]？
A: [100文字程度の具体的な回答]

### Q: [質問2]？
A: [回答]

### Q: [質問3]？
A: [回答]

## まとめ

- まとめポイント1
- まとめポイント2
- まとめポイント3`,
  }],
});

const text = response.content[0].text.trim();
const lines = text.split("\n");

const categorySlug = lines[0].replace("CATEGORY_SLUG:", "").trim();
const urlSlug      = lines[1].replace("URL_SLUG:", "").trim();
const imageQueries = lines[2].replace("IMAGE_QUERIES:", "").trim().split("|").map(q => q.trim());

if (!CATEGORIES[categorySlug]) {
  throw new Error(`Unknown category: "${categorySlug}". Valid: ${Object.keys(CATEGORIES).join(", ")}`);
}
if (!urlSlug || !/^[a-z0-9-]+$/.test(urlSlug)) {
  throw new Error(`Invalid URL slug: "${urlSlug}"`);
}

const rawContent = lines.slice(3).join("\n").trim();

// ── Download images ───────────────────────────────────────────────────────────
const baseKeyword = CATEGORY_KEYWORDS[categorySlug];
const heroQuery   = imageQueries[0] ?? baseKeyword;

if (!fs.existsSync(IMAGES_PUBLIC_DIR)) fs.mkdirSync(IMAGES_PUBLIC_DIR, { recursive: true });

console.log(`\n🖼  ヒーロー画像: "${heroQuery}"`);
const heroPath   = `${IMAGES_PUBLIC_DIR}/${urlSlug}-hero.jpg`;
const heroOk     = await downloadUnsplashImage(heroQuery, heroPath);
const heroPublic = heroOk ? `/images/articles/${urlSlug}-hero.jpg` : "";

const bodyImgOk = [];
for (let i = 1; i < imageQueries.length; i++) {
  const q = imageQueries[i] ?? baseKeyword;
  console.log(`\n🖼  本文画像 ${i}: "${q}"`);
  const ok = await downloadUnsplashImage(q, `${IMAGES_PUBLIC_DIR}/${urlSlug}-body-${i}.jpg`);
  bodyImgOk.push(ok);
}

// ── Build final content ───────────────────────────────────────────────────────
let finalContent = rawContent.replace("'HERO_IMAGE'", heroPublic ? `'${heroPublic}'` : "");
finalContent = insertBodyImages(finalContent, urlSlug, bodyImgOk.some(Boolean));

// ── Write file ────────────────────────────────────────────────────────────────
const dir = `src/content/blog/${categorySlug}`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filename = `${dir}/${urlSlug}.md`;
fs.writeFileSync(filename, finalContent);

console.log(`\n✅ 記事を生成しました: ${filename}`);
console.log(`   URL: /${categorySlug}/${urlSlug}/`);
if (heroPublic) console.log(`   ヒーロー画像: ${heroPublic}`);
