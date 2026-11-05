// Vercel Edge Middleware: HTTP Basic Auth gate in front of every request.
//
// The repo is private, so hardcoding the password is acceptable; to rotate it later,
// change this value and redeploy, or move it to a Vercel env var SITE_PASSWORD.
// Any username works — the prompt only cares about the password.

export const config = {
  // Protect every path, including /model.glb and /renders/*, so nothing leaks via a
  // direct asset URL. Vercel's own internal routes (_next, etc.) are not used here.
  matcher: '/:path*',
};

const PASSWORD = 'MRMT';

export default function middleware(request) {
  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = atob(encoded);
        const i = decoded.indexOf(':');
        if (i !== -1 && decoded.substring(i + 1) === PASSWORD) {
          return; // credentials match — let the request through
        }
      } catch {}
    }
  }
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Klingelbeek Viewer"',
      'Content-Type': 'text/plain',
    },
  });
}
