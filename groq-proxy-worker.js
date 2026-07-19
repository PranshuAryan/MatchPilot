/**
 * groq-proxy-worker.js
 * ─────────────────────────────────────────────────────────────────
 * A minimal Cloudflare Worker that keeps your Groq API key on the
 * server and forwards requests from the browser to Groq.
 *
 * WHY THIS EXISTS
 * The front-end files (challenge_3.html, route.html, scoreboard.html,
 * stadium.html) used to call https://api.groq.com directly from the
 * browser with the key pasted into the JS. That means anyone who
 * opens dev tools / view-source can steal the key and run up your
 * bill or get it revoked. This worker fixes that: the key lives only
 * in Cloudflare's encrypted secret store, never in code the browser
 * downloads.
 *
 * DEPLOY (takes ~2 minutes, free tier is enough):
 *   1. npm install -g wrangler        (if you don't have it)
 *   2. wrangler login
 *   3. wrangler init groq-proxy --from-dash=false   (or just create
 *      a new Worker project and drop this file in as src/index.js)
 *   4. wrangler secret put GROQ_API_KEY
 *        -> paste your real key when prompted (get one at console.groq.com)
 *   5. wrangler deploy
 *   6. You'll get a URL like: https://groq-proxy.yourname.workers.dev
 *
 * THEN, in each HTML file, change:
 *   const GROQ_PROXY_URL = '/api/groq/chat'
 * to:
 *   const GROQ_PROXY_URL = 'https://groq-proxy.yourname.workers.dev/chat'
 * and the audio fetch URL from '/api/groq/audio' to
 *   'https://groq-proxy.yourname.workers.dev/audio'
 *
 * (If you deploy the HTML itself behind Cloudflare Pages/Workers on
 * the same domain, you can instead route /api/groq/* to this worker
 * and leave the relative paths as-is — see wrangler.toml notes below.)
 * ─────────────────────────────────────────────────────────────────
 */

// Restrict which origins are allowed to call this proxy. Update this
// to your actual deployed site's origin(s) before going live.
const ALLOWED_ORIGINS = [
  'https://your-site.pages.dev',
  'http://localhost:8788', // local wrangler/pages dev server
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: GROQ_API_KEY secret not set.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    let targetUrl;
    let upstreamHeaders = { Authorization: `Bearer ${env.GROQ_API_KEY}` };
    let upstreamBody;

    if (url.pathname.endsWith('/chat')) {
      targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
      upstreamHeaders['Content-Type'] = 'application/json';
      upstreamBody = await request.text(); // pass the JSON body straight through
    } else if (url.pathname.endsWith('/audio')) {
      targetUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      upstreamBody = await request.formData(); // pass multipart form-data straight through
    } else {
      return new Response('Not found', { status: 404 });
    }

    try {
      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: upstreamBody,
      });

      const responseBody = await upstreamRes.text();
      return new Response(responseBody, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json',
          ...corsHeaders(origin),
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream request to Groq failed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }
  },
};
