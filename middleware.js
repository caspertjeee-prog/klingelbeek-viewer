// Vercel Edge Middleware: in-page form login + session cookie.
//
// Behaviour by request:
//   - No / invalid cookie   → dark-themed login form (HTTP 401).
//   - POST /__login correct → set signed session cookie, 303 back to the target.
//   - POST /__login wrong   → re-render login form with error.
//   - Valid cookie          → let the request through.
//
// Session cookie (no Max-Age / Expires):
//   The cookie is cleared when the browser session ends — closing the tab or window
//   kicks the user back to the login form. F5 within the same session does NOT re-prompt
//   (that's how web cookies work; a stronger "F5 = re-login" behaviour needs the whole
//   client to be rewritten to keep auth in in-memory JS only).
//
// Signed value (HMAC-SHA256):
//   Cookie value is `<issued_at>.<base64url(HMAC)>`. We refuse any cookie we didn't sign,
//   and refuse any cookie older than MAX_AGE_SECONDS even if the browser kept it alive
//   (e.g. via Chrome's "continue where you left off" session restore). Rotate the secret
//   to invalidate every existing session at once.
//
// Iframe cookie:
//   SameSite=None + Secure + Partitioned are required for the cookie to be stored by
//   modern browsers when the viewer is loaded inside an iframe on another origin (e.g.
//   mistermuratori.com on Wix). Partitioned scopes it to that (top-site, embedded-site)
//   pair, which is the CHIPS replacement for unrestricted third-party cookies.

export const config = {
  // Protect everything, including /model.glb and /renders/*, so nothing leaks via direct
  // asset URLs.
  matcher: '/:path*',
};

// Both come from Vercel env vars (dashboard → Settings → Environment Variables).
// The fallbacks are for local dev only; running the live site with the fallback SECRET
// would be a real security hole, so SITE_AUTH_SECRET MUST be set in Vercel production.
const PASSWORD         = (globalThis.process && process.env && process.env.SITE_PASSWORD)     || 'dev-only-password';
const SECRET           = (globalThis.process && process.env && process.env.SITE_AUTH_SECRET) || 'dev-only-insecure-secret';
const COOKIE_NAME      = 'klingel_auth';
const MAX_AGE_SECONDS  = 60 * 60 * 24; // 24h absolute cap on a signed cookie

// ---------- HMAC helpers (Web Crypto, available in the Edge runtime) --------------------
const encoder = new TextEncoder();

function b64urlEncode(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(data) {
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
  return b64urlEncode(sig);
}

async function verify(data, sigB64) {
  try {
    const key = await hmacKey();
    return crypto.subtle.verify('HMAC', key, b64urlDecode(sigB64), encoder.encode(data));
  } catch {
    return false;
  }
}

// ---------- Cookie value ----------------------------------------------------------------
async function mintCookieValue() {
  const issued = Math.floor(Date.now() / 1000).toString();
  const sig = await sign(issued);
  return `${issued}.${sig}`;
}

async function cookieValueIsValid(value) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [issuedStr, sig] = parts;
  const issued = parseInt(issuedStr, 10);
  if (!Number.isFinite(issued)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - issued > MAX_AGE_SECONDS) return false;
  if (issued - now > 60) return false; // tolerate ~1min clock skew
  return verify(issuedStr, sig);
}

function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function setCookieHeader(value) {
  // No Max-Age / Expires = session cookie (cleared when the browser session ends).
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;
}
function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`;
}

// ---------- Middleware ------------------------------------------------------------------
export default async function middleware(request) {
  const url = new URL(request.url);

  // Login submit
  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData();
    const pw = form.get('password');
    const raw = form.get('redirect') || '/';
    const target = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    if (pw === PASSWORD) {
      const value = await mintCookieValue();
      return new Response(null, {
        status: 303,
        headers: {
          'Location': target,
          'Set-Cookie': setCookieHeader(value),
          'Cache-Control': 'no-store',
        },
      });
    }
    return new Response(loginPage(target, true), {
      status: 401,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Auth check on everything else
  const cookie = readCookie(request, COOKIE_NAME);
  if (await cookieValueIsValid(cookie)) return; // allow

  // Missing or invalid — clear a stale cookie and show the login form
  return new Response(loginPage(url.pathname + url.search, false), {
    status: 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': clearCookieHeader(),
      'Cache-Control': 'no-store',
    },
  });
}

// ---------- Login page ------------------------------------------------------------------
function loginPage(redirect, error) {
  const safe = String(redirect).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const errorHtml = error ? `<p class="err">Wrong password — try again.</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Klingelbeek Viewer</title>
<style>
  html,body{height:100%;margin:0;background:#1f232b;color:#f5f5f5;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box}
  .card{width:100%;max-width:320px;padding:28px 24px;background:rgba(28,32,40,0.94);border:1px solid rgba(255,255,255,0.08);border-radius:10px}
  h1{margin:0 0 4px;font-size:16px;font-weight:600;letter-spacing:.02em;color:#f5f5f5}
  .sub{margin:0 0 20px;font-size:12px;color:#a0a7b1;letter-spacing:.03em}
  label{display:block;font-size:11px;color:#a0a7b1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
  input[type=password]{width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#f5f5f5;font:14px/1.2 inherit;outline:none}
  input[type=password]:focus{border-color:#d9c8a3}
  button{margin-top:14px;width:100%;padding:10px 12px;background:#d9c8a3;color:#1f232b;border:0;border-radius:6px;font:13px/1 inherit;font-weight:600;cursor:pointer;letter-spacing:.02em}
  button:hover{background:#e3d4b0}
  .err{color:#ff8a7a;font-size:12px;margin:12px 0 0}
</style>
</head>
<body>
<div class="wrap">
  <form class="card" method="POST" action="/__login" autocomplete="off">
    <h1>Klingelbeek Viewer</h1>
    <p class="sub">Enter password to continue</p>
    <label for="pw">Password</label>
    <input id="pw" name="password" type="password" autofocus required>
    <input type="hidden" name="redirect" value="${safe}">
    <button type="submit">Enter</button>
    ${errorHtml}
  </form>
</div>
</body>
</html>`;
}
