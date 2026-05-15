import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

const today = new Date().toISOString().split("T")[0];

const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 2000,
  messages: [
    {
      role: "user",
      content: `あなたはオンライン学習・資格講座の専門メディアのライターです。
日本語で800文字程度のブログ記事を書いてください。

以下のテーマからランダムに1つ選んで記事を書いてください：
- オンライン資格講座の比較・レビュー
- 独学vs通信講座のメリット・デメリット
- 社会人が資格取得するコツ
- おすすめのeラーニングサービス紹介
- 在宅で取れる人気資格ランキング

以下のMarkdown形式で出力してください。フロントマター込みで出力し、それ以外の文章は一切出力しないでください。

---
title: '記事タイトル'
description: '記事の説明（120文字以内）'
pubDate: '${today}'
---

記事本文`,
    },
  ],
});

const content = response.content[0].text;
const filename = `src/content/blog/article-${today}.md`;
fs.writeFileSync(filename, content);
console.log(`記事を生成しました: ${filename}`);