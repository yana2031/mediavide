/**
 * GSC + GA4 データを取得して analytics-data.json に保存
 *
 * 必要な環境変数:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  - サービスアカウントの JSON キー（文字列）
 *   GSC_SITE_URL                 - 例: https://shikaku-online.com/
 *   GA4_PROPERTY_ID              - 例: 123456789
 */
import { google } from 'googleapis';
import fs from 'fs';

const SA_JSON   = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SITE_URL  = process.env.GSC_SITE_URL;
const GA4_ID    = process.env.GA4_PROPERTY_ID;

if (!SA_JSON || !SITE_URL || !GA4_ID) {
  console.error('❌ 環境変数 GOOGLE_SERVICE_ACCOUNT_JSON / GSC_SITE_URL / GA4_PROPERTY_ID が未設定');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(SA_JSON),
  scopes: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
  ],
});

// ── 期間 ──────────────────────────────────────────────────────────────────────
const END   = new Date();
const START = new Date();
START.setDate(END.getDate() - 28);
const fmt = d => d.toISOString().slice(0, 10);
const startDate = fmt(START);
const endDate   = fmt(END);

console.log(`📅 分析期間: ${startDate} 〜 ${endDate}`);

// ── Search Console ────────────────────────────────────────────────────────────
async function fetchGSC() {
  const sc = google.searchconsole({ version: 'v1', auth });

  // ページ別パフォーマンス
  const pageRes = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate, endDate,
      dimensions: ['page'],
      rowLimit: 100,
    },
  });

  // ページ×クエリ別（上位クエリを把握）
  const queryRes = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate, endDate,
      dimensions: ['page', 'query'],
      rowLimit: 500,
    },
  });

  // ページ別にまとめる
  const pages = {};
  for (const row of (pageRes.data.rows ?? [])) {
    const url = row.keys[0];
    pages[url] = {
      clicks:      row.clicks,
      impressions: row.impressions,
      ctr:         Math.round(row.ctr * 1000) / 10,   // %
      position:    Math.round(row.position * 10) / 10,
      queries: [],
    };
  }
  for (const row of (queryRes.data.rows ?? [])) {
    const [url, query] = row.keys;
    if (!pages[url]) continue;
    pages[url].queries.push({
      query,
      clicks:      row.clicks,
      impressions: row.impressions,
      ctr:         Math.round(row.ctr * 1000) / 10,
      position:    Math.round(row.position * 10) / 10,
    });
  }
  // クエリをインプレッション順にソート、上位10件に絞る
  for (const p of Object.values(pages)) {
    p.queries.sort((a, b) => b.impressions - a.impressions);
    p.queries = p.queries.slice(0, 10);
  }

  console.log(`✅ GSC: ${Object.keys(pages).length} ページ取得`);
  return pages;
}

// ── GA4 ───────────────────────────────────────────────────────────────────────
async function fetchGA4() {
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  const res = await analytics.properties.runReport({
    property: `properties/${GA4_ID}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'screenPageViews' },
      ],
      limit: 100,
    },
  });

  const pages = {};
  for (const row of (res.data.rows ?? [])) {
    const path = row.dimensionValues[0].value;
    const [sessions, engaged, duration, bounceRate, pageviews] = row.metricValues.map(m => parseFloat(m.value));
    pages[path] = {
      sessions:        Math.round(sessions),
      engagedSessions: Math.round(engaged),
      avgDuration:     Math.round(duration),       // 秒
      bounceRate:      Math.round(bounceRate * 100), // %
      pageviews:       Math.round(pageviews),
      engagementRate:  sessions > 0 ? Math.round((engaged / sessions) * 100) : 0, // %
    };
  }

  console.log(`✅ GA4: ${Object.keys(pages).length} ページ取得`);
  return pages;
}

// ── 記事ファイルの一覧 ────────────────────────────────────────────────────────
function listArticles() {
  const base = 'src/content/blog';
  const articles = [];
  for (const cat of fs.readdirSync(base)) {
    const dir = `${base}/${cat}`;
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const slug = file.replace('.md', '');
      const content = fs.readFileSync(`${dir}/${file}`, 'utf-8');
      // frontmatter から title / description を抽出
      const titleMatch = content.match(/^title:\s*'(.+)'/m);
      const descMatch  = content.match(/^description:\s*'(.+)'/m);
      articles.push({
        category: cat,
        slug,
        filePath: `${dir}/${file}`,
        url: `/${cat}/${slug}/`,
        title:       titleMatch?.[1] ?? '',
        description: descMatch?.[1] ?? '',
      });
    }
  }
  return articles;
}

// ── マージ & 保存 ─────────────────────────────────────────────────────────────
const [gscData, ga4Data] = await Promise.all([fetchGSC(), fetchGA4()]);
const articles = listArticles();

const merged = articles.map(article => {
  const fullUrl = SITE_URL.replace(/\/$/, '') + article.url;
  const gsc = gscData[fullUrl] ?? gscData[article.url] ?? null;
  const ga4 = ga4Data[article.url] ?? null;
  return { ...article, gsc, ga4 };
});

const output = { fetchedAt: new Date().toISOString(), period: { startDate, endDate }, articles: merged };
fs.writeFileSync('analytics-data.json', JSON.stringify(output, null, 2));
console.log('\n✅ analytics-data.json を保存しました');
console.log('\n📊 サマリー:');
for (const a of merged) {
  const pos  = a.gsc ? `位置: ${a.gsc.position}` : 'GSCデータなし';
  const ctr  = a.gsc ? `CTR: ${a.gsc.ctr}%` : '';
  const eng  = a.ga4 ? `エンゲージメント率: ${a.ga4.engagementRate}%` : 'GA4データなし';
  console.log(`  ${a.url}  ${pos}  ${ctr}  ${eng}`);
}
