const VERIFICATION = 'google-site-verification: google5f5a06f14391cef4.html\n';

export const config = {
  matcher: '/google5f5a06f14391cef4.html',
};

export default function middleware() {
  return new Response(VERIFICATION, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
