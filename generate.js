import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic();
const today = new Date().toLocaleDateString('sv-SE');
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

async function generateAiImage(query, outputPath, size = "1536x1024") {
  if (fs.existsSync(outputPath)) {
    console.log(`  ✅ スキップ（既存）: ${outputPath}`);
    return true;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("  ⚠ OPENAI_API_KEY が未設定のため画像をスキップします");
    return false;
  }
  const prompt = `A professional, photo-realistic image for a Japanese online education website. Scene: ${query}. Focus on people and workspace environments — avoid showing books, screens, or any objects with visible text. Absolutely no text, letters, characters, or writing of any kind anywhere in the image. No watermarks, no logos. Warm natural lighting, clean and inspiring atmosphere.`;
  try {
    const apiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size,
        quality: "medium",
      }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.json();
      console.warn(`  ⚠ 画像生成 API エラー: ${apiRes.status}`, err.error?.message ?? "");
      return false;
    }
    const data = await apiRes.json();
    // gpt-image-1 は b64_json で返る
    const b64 = data.data[0].b64_json;
    const buffer = Buffer.from(b64, "base64");

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log(`  🎨 生成: ${outputPath}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠ 画像生成エラー: ${err.message}`);
    return false;
  }
}

async function generateInfographicImage(prompt, outputPath) {
  if (fs.existsSync(outputPath)) {
    console.log(`  ✅ スキップ（既存）: ${outputPath}`);
    return true;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;
  try {
    const apiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size: "1536x1024", quality: "high" }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.json();
      console.warn(`  ⚠ インフォグラフィック API エラー: ${apiRes.status}`, err.error?.message ?? "");
      return false;
    }
    const data = await apiRes.json();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(data.data[0].b64_json, "base64"));
    console.log(`  📊 生成: ${outputPath}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠ インフォグラフィック生成エラー: ${err.message}`);
    return false;
  }
}

function insertInfographic(content, slug) {
  const lines = content.split("\n");
  let lastTableLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("|")) lastTableLine = i;
  }
  if (lastTableLine === -1) return content;
  let insertAt = lastTableLine + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
  if (insertAt < lines.length && lines[insertAt].startsWith("※")) insertAt++;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  return [...before, "", `![](/images/articles/${slug}-info-1.jpg)`, "", ...after].join("\n");
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
    content: `あなたは社会人の資格取得・学習を専門に取材・調査する編集者です。
読者に寄り添う語り口を大切にしていますが、自分自身が資格を取得した体験は持っていません。
実際に資格を取得した社会人への取材・アンケート・公式情報の調査をもとに記事を書きます。

【ターゲット読者】
20〜40代の社会人。残業が多く、家族もいて、本当に時間がない。でも転職・昇進のために何とかしたい。
「本当に自分にできるのか」という不安が強い。成功談よりも「実際のところどうなの？」という本音を求めている。

【カテゴリー選択】以下から最も適切な1つを選んでください：
${categoryList}

━━━━━━━━━━━━━━━━━━━━━━━━━━
【文体・トーンの絶対ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ やるべきこと：
- 文体は「ですます調」で統一する。読者に語りかけるように書く
- 短文と長文を意図的に混ぜる。「結論から言うと、〜です。」のような断言を使う
- 一人称（「私」）は感情・共感・疑問の表現にのみ使う
  OK例：「その不安、よくわかります」「正直に言うと、これは難しい問いです」「〜と感じたことはありませんか？」
- 具体的な体験・失敗談は必ず取材対象者に帰属させる
  OK例：「取材したAさん（35歳・営業職）は〜と話します」「複数の合格者に聞いたところ、〜という声が多くありました」
- 通説・定番アドバイスを一度疑う。「よく言われますが、実際はそうでもありません」という逆張りを1つ以上入れる
- 体言止めを適度に使う（例：「これが最大の落とし穴です。」）
- セクションごとに文体・長さ・テンポを変える（全部同じにしない）
- 読者が「あるある」と感じる具体的な場面描写を入れる
  （例：「夜11時に帰宅してテキストを開いたものの、気づいたら寝落ちしていた、なんて経験はありませんか？」）
- 数字を使う場合は出典か状況を明記する（「〇〇の公式サイトによると」「受験者の声をまとめると」など）
- ペルソナ事例は自然な文章で始める（例：「Bさんは35歳、メーカー勤務のエンジニアです。」）

❌ 絶対にやらないこと：
- 「私は〇〇を取得しました」「自分が受験したとき〜」など、編集者自身の資格取得・受験体験として書く
- 「〜のが現実です」「〜という方は少なくありません」「〜にすぎません」「きっと〜なはずです」
- 全ての小見出し・箇条書きを同じ文字数・同じ構造にする
- 「①〜　②〜　③〜」を全て同じ長さで並べる
- 根拠のない丸い数字（「約7割」「1.5〜2倍」）を出典なしで使う
- 全セクションを「問題提起→解決策→まとめ」の同じ構造にする
- 成功事例だけ書いて失敗・挫折・デメリットに触れない
- 「重要です」「大切です」「効果的です」を多用する
- ペルソナ紹介を「**Aさん（34歳・男性・〇〇職）**」のようにbold+カッコで属性を羅列して始める
- 「——」のような記号を文中のデザインや区切りに使う（代わりに読点や改行で表現する）

━━━━━━━━━━━━━━━━━━━━━━━━━━
【記事構成の必須要素】
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 冒頭に「この記事でわかること」のblockquote（> 記法）
2. リード文：読者の「あるある」な場面を描写し、共感を得る（説教しない）
3. H2見出し4〜6個：Googleで検索されそうな具体的フレーズ。セクションごとに視点を変える
4. 途中に比較表（Markdownテーブル）を1つ
5. 「ペルソナ事例」1つ：成功だけでなく、最初の失敗や苦労も書く
6. 「## よくある質問（FAQ）」：### Q: 〜？ / A: 〜の形式で3問。「正直〜」という本音で答える
7. 「## まとめ」：箇条書き＋最後に一言メッセージ（説教にならない励まし）

━━━━━━━━━━━━━━━━━━━━━━━━━━
【SEO要件】
━━━━━━━━━━━━━━━━━━━━━━━━━━
- タイトル：【${year}年版】などのパワーワード＋検索意図、50文字以内
- description：120文字以内、主要キーワードを含む

━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力形式】この形式のみで出力し、前後に説明文を書かないこと
━━━━━━━━━━━━━━━━━━━━━━━━━━

CATEGORY_SLUG: [選んだカテゴリーのslug]
URL_SLUG: [英語slug、小文字・ハイフン区切り・3〜5単語]
IMAGE_QUERIES: [ヒーロー画像用英語クエリ]|[本文画像1用英語クエリ]|[本文画像2用英語クエリ]
※IMAGE_QUERIESの絶対ルール：
- 人物・場所・雰囲気・光の質感を具体的に描写する英語フレーズ（5〜9語）にすること
- 本・教科書・ノート・画面・文字が写るものは一切含めない
- 3枚がすべて異なるシチュエーション・構図になるよう意識する
- ヒーロー：広がりのある場面（例：カフェの窓際、自宅リビング朝の光、オフィスのデスク）
- 本文1：アクティブな場面（例：通勤電車、休憩室、立ち仕事の合間）
- 本文2：感情・結果を表す場面（例：達成感、リラックス、集中）
- 性別・年齢・場所・時間帯を毎回バラバラにすること
- 悪い例（単調）：「adult studying at desk」「person studying」「woman at desk」
- 良い例（多様）：「young woman smiling at cafe window morning sunlight」「tired businessman on commuter train eyes closed headphones」「middle-aged man fist pump at home office evening lamp」
INFOGRAPHIC_PROMPT: [記事内の比較表をインフォグラフィック化するための英語プロンプト。1行で書くこと。比較表の全データ（列名・行・値）を含め、gpt-image-2が正確に描画できるよう具体的に記述する。日本語テキストはそのまま含めてよい。デザイン指示も含める：white background, modern minimal Japanese design, soft blue accent, clear readable fonts.]
---
title: '記事タイトル'
description: '説明文（120文字以内）'
pubDate: '${today}'
heroImage: 'HERO_IMAGE'
category: '[CATEGORY_SLUGと同じ値]'
---

> **📋 この記事でわかること**
>
> - わかること1
> - わかること2
> - わかること3

[本文]`,
  }],
});

const text = response.content[0].text.trim();
const lines = text.split("\n");

const categorySlug      = lines[0].replace("CATEGORY_SLUG:", "").trim();
const urlSlug           = lines[1].replace("URL_SLUG:", "").trim();
const imageQueries      = lines[2].replace("IMAGE_QUERIES:", "").trim().split("|").map(q => q.trim());
const infographicPrompt = lines[3].replace("INFOGRAPHIC_PROMPT:", "").trim();

if (!CATEGORIES[categorySlug]) {
  throw new Error(`Unknown category: "${categorySlug}". Valid: ${Object.keys(CATEGORIES).join(", ")}`);
}
if (!urlSlug || !/^[a-z0-9-]+$/.test(urlSlug)) {
  throw new Error(`Invalid URL slug: "${urlSlug}"`);
}

const rawContent = lines.slice(4).join("\n").trim();

// ── Download images ───────────────────────────────────────────────────────────
if (!fs.existsSync(IMAGES_PUBLIC_DIR)) fs.mkdirSync(IMAGES_PUBLIC_DIR, { recursive: true });

const heroQuery  = imageQueries[0] ?? CATEGORY_KEYWORDS[categorySlug];
console.log(`\n🖼  ヒーロー画像: "${heroQuery}"`);
const heroPath   = `${IMAGES_PUBLIC_DIR}/${urlSlug}-hero.jpg`;
const heroOk     = await generateAiImage(heroQuery, heroPath, "1536x1024");
const heroPublic = heroOk ? `/images/articles/${urlSlug}-hero.jpg` : "";

const bodyImgOk = [];
for (let i = 1; i < imageQueries.length; i++) {
  const q = imageQueries[i] ?? CATEGORY_KEYWORDS[categorySlug];
  console.log(`\n🖼  本文画像 ${i}: "${q}"`);
  const ok = await generateAiImage(q, `${IMAGES_PUBLIC_DIR}/${urlSlug}-body-${i}.jpg`, "1024x1024");
  bodyImgOk.push(ok);
}

// ── Generate infographic ──────────────────────────────────────────────────────
console.log(`\n📊 インフォグラフィック生成中...`);
const infoPath = `${IMAGES_PUBLIC_DIR}/${urlSlug}-info-1.jpg`;
const infoOk = await generateInfographicImage(infographicPrompt, infoPath);

// ── Build final content ───────────────────────────────────────────────────────
let finalContent = rawContent.replace("'HERO_IMAGE'", heroPublic ? `'${heroPublic}'` : "");
finalContent = insertBodyImages(finalContent, urlSlug, bodyImgOk.some(Boolean));
if (infoOk) finalContent = insertInfographic(finalContent, urlSlug);

// ── Write file ────────────────────────────────────────────────────────────────
const dir = `src/content/blog/${categorySlug}`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filename = `${dir}/${urlSlug}.md`;
fs.writeFileSync(filename, finalContent);

console.log(`\n✅ 記事を生成しました: ${filename}`);
console.log(`   URL: /${categorySlug}/${urlSlug}/`);
if (heroPublic) console.log(`   ヒーロー画像: ${heroPublic}`);
