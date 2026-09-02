const APP_URL = 'https://jagra27.github.io/Homecoming_2026/'
const ALLOWED_ORIGINS = new Set([
  new URL(APP_URL).origin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

function corsHeaders(request) {
  const origin = request.headers.get('Origin')
  return ALLOWED_ORIGINS.has(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {}
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character])
}

function jsonResponse(request, body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

async function createShare(request, env) {
  const origin = request.headers.get('Origin')
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(request, { error: 'Origin not allowed' }, 403)
  }

  const formData = await request.formData()
  const image = formData.get('image')
  if (!(image instanceof File) || image.type !== 'image/png') {
    return jsonResponse(request, { error: 'A PNG image is required' }, 400)
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return jsonResponse(request, { error: 'Image exceeds the 15 MB limit' }, 413)
  }

  const firstNameValue = formData.get('firstName')
  const firstName = typeof firstNameValue === 'string'
    ? firstNameValue.trim().slice(0, 40) || 'A friend'
    : 'A friend'
  const shareId = crypto.randomUUID()
  await env.CARD_PREVIEWS.put(`cards/${shareId}.png`, image.stream(), {
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { firstName },
  })

  const baseUrl = new URL(request.url).origin
  return jsonResponse(request, { shareUrl: `${baseUrl}/share/${shareId}` }, 201)
}

async function serveImage(shareId, env) {
  const object = await env.CARD_PREVIEWS.get(`cards/${shareId}.png`)
  if (!object) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('ETag', object.httpEtag)
  return new Response(object.body, { headers })
}

async function serveSharePage(request, shareId, env) {
  const object = await env.CARD_PREVIEWS.head(`cards/${shareId}.png`)
  if (!object) return Response.redirect(APP_URL, 302)

  const firstName = object.customMetadata?.firstName || 'A friend'
  const description = `${firstName} wants you to create your trading card for Homecoming! Powered by Desires By Saint.`
  const origin = new URL(request.url).origin
  const shareUrl = `${origin}/share/${shareId}`
  const imageUrl = `${origin}/images/${shareId}.png`
  const title = `${firstName}'s Homecoming 2026 Invitation`

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${shareUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="928">
  <meta property="og:image:height" content="1312">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body>
  <p>${escapeHtml(description)}</p>
  <p><a href="${APP_URL}">Create your Homecoming card</a></p>
  <script>window.location.replace(${JSON.stringify(APP_URL)})</script>
</body>
</html>`, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (request.method === 'POST' && url.pathname === '/api/shares') {
      return createShare(request, env)
    }

    const shareMatch = url.pathname.match(/^\/share\/([a-f0-9-]+)$/)
    if (request.method === 'GET' && shareMatch) {
      return serveSharePage(request, shareMatch[1], env)
    }
    const imageMatch = url.pathname.match(/^\/images\/([a-f0-9-]+)\.png$/)
    if (request.method === 'GET' && imageMatch) {
      return serveImage(imageMatch[1], env)
    }
    return new Response('Not found', { status: 404 })
  },
}
