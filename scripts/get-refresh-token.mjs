/**
 * GA4 / GSC 用 OAuth リフレッシュトークン取得スクリプト（一回だけ実行）
 *
 * 実行方法:
 *   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy node scripts/get-refresh-token.mjs
 *
 * ブラウザが開くので Google アカウントでログイン → 完了するとリフレッシュトークンが表示されます
 */
import { google } from 'googleapis';
import http from 'http';
import { CLIENT_ID, CLIENT_SECRET } from './oauth-config.mjs';

if (CLIENT_ID.includes('ここに') || CLIENT_SECRET.includes('ここに')) {
  console.error('❌ scripts/oauth-config.mjs にクライアントID・シークレットを入力してください');
  process.exit(1);
}

const PORT         = 3456;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',   // 必ず refresh_token を発行させる
  scope: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
  ],
});

console.log('\n🌐 以下の URL をブラウザで開いてください:\n');
console.log(authUrl);
console.log('\n（自動で開かない場合は上記 URL をコピーしてブラウザに貼り付けてください）\n');

// ブラウザを自動オープン（macOS/Linux のみ）
import { exec } from 'child_process';
if (process.platform === 'darwin') exec(`open "${authUrl}"`);
else if (process.platform === 'linux') exec(`xdg-open "${authUrl}"`);

// ローカルサーバーでコールバックを受け取る
const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('コードが見つかりません');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h2>✅ 認証完了！ターミナルを確認してください。このタブは閉じて大丈夫です。</h2>');
  server.close();

  try {
    const { tokens } = await oauth2.getToken(code);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ リフレッシュトークンを取得しました！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n以下の3つを GitHub Secrets に登録してください:\n');
    console.log(`GOOGLE_OAUTH_CLIENT_ID     = ${CLIENT_ID}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET = ${CLIENT_SECRET}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN = ${tokens.refresh_token}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ トークン取得エラー:', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`⏳ ブラウザでの認証を待っています... (port ${PORT})`);
});
