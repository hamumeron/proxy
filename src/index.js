const PASSWORD = BINDING.PASSWORD || '114514'; // wrangler varsから
const COOKIE_NAME = BINDING.COOKIE_NAME || 'auth';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const method = request.method;

  // 認証チェック
  if (cookies[COOKIE_NAME] !== 'yes') {
    if (url.pathname === '/login' && method === 'POST') {
      const form = await request.formData();
      const pw = form.get('password');
      if (pw === PASSWORD) {
        return new Response('', {
          status: 302,
          headers: {
            'Location': '/',
            'Set-Cookie': `${COOKIE_NAME}=yes; Max-Age=3600; Path=/; HttpOnly`,
          }
        });
      } else {
        return new Response(renderLoginPage('パスワードが違います'), {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
      }
    }

    return new Response(renderLoginPage(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }

  // プロキシ処理（単純中継）
  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target || !target.startsWith('http')) {
      return new Response('無効なURLです', { status: 400 });
    }

    // fetchしてそのまま返す（リライト無し）
    const res = await fetch(target, {
      // 必要ならヘッダー追加
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const contentType = res.headers.get('content-type') || '';
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': contentType }
    });
  }

  // フォーム画面
  if (method === 'GET') {
    return new Response(renderForm(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }

  if (method === 'POST') {
    const formData = await request.formData();
    const target = formData.get('url');
    if (!target || !target.startsWith('http')) {
      return new Response(renderForm('<p style="color:red;">URLが正しくありません</p>'), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }
    return Response.redirect(`/proxy?url=${encodeURIComponent(target)}`, 302);
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// --- ログイン画面 ---
function renderLoginPage(message = '') {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ログイン</title>
<style>
body{font-family:sans-serif;background:#111;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh}
form{background:#222;padding:20px;border-radius:10px}
input,button{display:block;width:100%;margin-top:10px;padding:10px;font-size:16px}
button{background:#00c9a7;color:#fff;border:none}
</style></head><body>
<form method="POST" action="/login">
<h2>パスワードを入力</h2>
${message ? `<p>${message}</p>` : ''}
<input type="password" name="password" placeholder="114514" required />
<button type="submit">ログイン</button>
</form></body></html>`;
}

// --- フォーム画面 ---
function renderForm(message = '') {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>匿名Webプロキシ</title>
  <style>
    body { font-family: sans-serif; background: #111; color: white; text-align: center; padding: 50px; }
    form { margin-top: 20px; }
    input, button {
      padding: 10px;
      font-size: 16px;
      border-radius: 6px;
      border: none;
      margin-top: 10px;
      width: 300px;
    }
    button {
      background-color: #00c9a7;
      color: white;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>匿名Webプロキシ</h1>
  ${message}
  <form method="POST">
    <input type="url" name="url" placeholder="https://example.com" required />
    <button type="submit">アクセス</button>
  </form>
</body>
</html>`;
}
