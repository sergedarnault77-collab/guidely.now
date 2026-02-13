export const config = { runtime: 'edge' }

const ALLOWED_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo',
  'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse',
]

const MODE_VOICE_MAP: Record<string, string> = {
  serious: 'onyx',
  casual: 'nova',
  demanding: 'ash',
  funny: 'alloy',
}

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY

  // ── Probe (GET) — lets client discover if cloud TTS is configured ──
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: !!apiKey }), {
      status: apiKey ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TTS not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Parse body ──
  let body: { text?: string; mode?: string; voice?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const text = body.text?.trim()
  if (!text) {
    return new Response(JSON.stringify({ error: 'Text is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (text.length > 4000) {
    return new Response(JSON.stringify({ error: 'Text too long (max 4000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Resolve voice: explicit override > mode mapping > default ──
  let voice = 'onyx'
  if (body.voice && ALLOWED_VOICES.includes(body.voice)) {
    voice = body.voice
  } else if (body.mode && MODE_VOICE_MAP[body.mode]) {
    voice = MODE_VOICE_MAP[body.mode]
  }

  // ── Call OpenAI Audio API ──
  const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      response_format: 'mp3',
    }),
  })

  if (!openaiRes.ok) {
    const detail = await openaiRes.text().catch(() => 'Unknown error')
    return new Response(JSON.stringify({ error: 'OpenAI TTS failed', detail }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Stream audio back to client ──
  return new Response(openaiRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0',
    },
  })
}
