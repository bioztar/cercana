// Shared AI plumbing for edge functions. Keys are Supabase secrets, never shipped to the app:
// THALAMUS_API_KEY / THALAMUS_BASE_URL (key alias "cercana", allowed nebius/*), DEEPGRAM_API_KEY.

// Kimi-K3 reads images too; thinking off so short max_tokens still return content.
export const MODEL = Deno.env.get('CERCANA_MODEL') ?? 'nebius/moonshotai/Kimi-K3';

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string | Part[] };

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing setting ${name}`);
  return v;
}

/** One chat completion via thalamus. `json: true` asks for a JSON object and parses it. */
export async function chat(messages: Msg[], opts: { json?: boolean; maxTokens?: number; model?: string } = {}) {
  const res = await fetch(`${env('THALAMUS_BASE_URL')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('THALAMUS_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: 0.2,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      chat_template_kwargs: { thinking: false },
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text: string = (await res.json()).choices?.[0]?.message?.content ?? '';
  return opts.json ? JSON.parse(text) : text;
}

/** Speech-to-text for a public audio URL (Supabase `media` bucket). Language auto-detected. */
export async function transcribe(audioUrl: string): Promise<{ text: string; language: string | null }> {
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&detect_language=true', {
    method: 'POST',
    headers: { Authorization: `Token ${env('DEEPGRAM_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: audioUrl }),
  });
  if (!res.ok) throw new Error(`stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ch = (await res.json()).results?.channels?.[0];
  return { text: ch?.alternatives?.[0]?.transcript ?? '', language: ch?.detected_language ?? null };
}
