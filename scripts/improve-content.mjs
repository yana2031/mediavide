/**
 * analytics-data.json を読み込み、Claude で分析・改善案を生成し記事に適用する
 *
 * 改善の種類:
 *   1. タイトル最適化      - 順位 1-10 で CTR < 3%
 *   2. description 最適化  - 順位 1-10 で CTR < 3%
 *   3. 本文セクション追加  - 上位クエリで順位 11-30 のものが存在
 *   4. リード文修正        - GA4 エンゲージメント率 < 40% または平均滞在 < 60秒
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic();
const today = new Date().toLocaleDateString('sv-SE');

if (!fs.existsSync('analytics-data.json')) {
  console.error('❌ analytics-data.json が見つかりません。先に fetch-analytics.mjs を実行してください');
  process.exit(1);
}

const { period, articles } = JSON.parse(fs.readFileSync('analytics-data.json', 'utf-8'));
console.log(`📅 分析期間: ${period.startDate} 〜 ${period.endDate}`);

// ── 改善が必要な記事を特定 ────────────────────────────────────────────────────
function diagnose(article) {
  const issues = [];
  const { gsc, ga4 } = article;

  if (gsc) {
    // タイトル・description 改善の余地
    if (gsc.position <= 10 && gsc.ctr < 3) {
      issues.push({ type: 'low_ctr', desc: `順位${gsc.position}位なのにCTR${gsc.ctr}%（目安3%以上）` });
    }
    // 11-30位で表示回数が多いクエリ = 上位進出の余地あり
    const nearMissQueries = (gsc.queries ?? []).filter(q => q.position > 10 && q.position <= 30 && q.impressions >= 20);
    if (nearMissQueries.length > 0) {
      issues.push({ type: 'near_miss', desc: `11〜30位クエリが${nearMissQueries.length}件（コンテンツ追加で上位狙える）`, queries: nearMissQueries });
    }
  }

  if (ga4) {
    if (ga4.engagementRate < 40) {
      issues.push({ type: 'low_engagement', desc: `エンゲージメント率${ga4.engagementRate}%（目安40%以上）` });
    }
    if (ga4.avgDuration < 60) {
      issues.push({ type: 'low_duration', desc: `平均滞在${ga4.avgDuration}秒（目安60秒以上）` });
    }
  }

  return issues;
}

// ── Claude に改善案を依頼 ─────────────────────────────────────────────────────
async function improveArticle(article, issues) {
  const content = fs.readFileSync(article.filePath, 'utf-8');
  const issueText = issues.map(i => `- ${i.desc}`).join('\n');
  const nearMissQueries = issues
    .filter(i => i.type === 'near_miss')
    .flatMap(i => i.queries.map(q => `「${q.query}」（${q.impressions}回表示・${q.position}位）`))
    .join(', ');

  const prompt = `あなたはSEOと読者体験の専門家です。以下のデータをもとに、記事を改善してください。

【分析期間】${period.startDate} 〜 ${period.endDate}

【課題】
${issueText}

${nearMissQueries ? `【上位進出の余地があるクエリ（本文に追加すべきトピック）】\n${nearMissQueries}` : ''}

【現在の記事】
${content}

━━━━━━━━━━━━━━━━━━━━━
【改善ルール】
- タイトルの改善：クリックしたくなる具体的な言葉を加える。数字・年・メリットを含める
- descriptionの改善：検索結果で読者の行動を引き出す120文字以内の文章
- 近似クエリへの対応：該当クエリのトピックを扱うH2セクションを1〜2個追加（既存の構成を壊さない）
- リード文の改善：最初の3段落で読者の「あるある」を描写し、続きを読みたくなる引力をつける
- 文体・トーンは元の記事と統一する（ですます調・取材者目線）
- pubDate は変更しない。updatedDate: '${today}' を frontmatter に追加する

【出力形式】改善後の記事全文をそのまま出力。前後に説明を書かない。`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

// ── レポート生成 ──────────────────────────────────────────────────────────────
function buildReport(results) {
  const lines = [
    `# コンテンツ改善レポート`,
    ``,
    `**分析期間:** ${period.startDate} 〜 ${period.endDate}  `,
    `**実行日:** ${today}`,
    ``,
    `## 改善した記事`,
    ``,
  ];

  for (const { article, issues } of results) {
    lines.push(`### ${article.title}`);
    lines.push(`URL: \`${article.url}\``);
    lines.push(`**課題:**`);
    for (const i of issues) lines.push(`- ${i.desc}`);
    lines.push(``);
  }

  lines.push(`## 改善不要だった記事`);
  lines.push(``);
  for (const a of articles) {
    const improved = results.find(r => r.article.slug === a.slug);
    if (!improved) {
      const gscInfo = a.gsc ? `順位${a.gsc.position}位 / CTR${a.gsc.ctr}%` : 'GSCデータなし';
      const ga4Info = a.ga4 ? `エンゲージメント${a.ga4.engagementRate}%` : 'GA4データなし';
      lines.push(`- **${a.title}** — ${gscInfo} / ${ga4Info}`);
    }
  }

  return lines.join('\n');
}

// ── メイン ────────────────────────────────────────────────────────────────────
const results = [];

for (const article of articles) {
  const issues = diagnose(article);
  if (issues.length === 0) {
    console.log(`✅ 改善不要: ${article.url}`);
    continue;
  }

  console.log(`\n🔧 改善対象: ${article.url}`);
  for (const i of issues) console.log(`   - ${i.desc}`);

  try {
    const improved = await improveArticle(article, issues);
    fs.writeFileSync(article.filePath, improved);
    console.log(`   ✍️ 改善適用: ${article.filePath}`);
    results.push({ article, issues });
  } catch (err) {
    console.warn(`   ⚠️ 改善スキップ: ${err.message}`);
  }
}

// レポートを保存
const report = buildReport(results);
fs.writeFileSync('improvement-report.md', report);
console.log('\n📄 improvement-report.md を保存しました');

if (results.length === 0) {
  console.log('\n✅ 改善が必要な記事はありませんでした');
} else {
  console.log(`\n✅ ${results.length}件の記事を改善しました`);
}
