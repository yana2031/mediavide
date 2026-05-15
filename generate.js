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
      content: `日本語で500文字程度のブログ記事を書いてください。
テーマは自由ですが、役に立つ情報を含めてください。
以下のMarkdown形式で出力してください。フロントマターも含めてください。

---
title: '記事タイトル'
description: '記事の説明'
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