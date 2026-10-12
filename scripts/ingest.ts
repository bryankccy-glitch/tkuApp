import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OFFICIAL_SOURCES } from '../src/data/sources.js';

const CHUNK_SIZE = 650;
const CHUNK_OVERLAP = 100;
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 32;

type Source = (typeof OFFICIAL_SOURCES)[number];
type DocumentRow = { id: string; content_hash: string | null };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少伺服器環境變數 ${name}`);
  return value;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('。', end), text.lastIndexOf('；', end), text.lastIndexOf(' ', end));
      if (boundary > start + CHUNK_SIZE * 0.65) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk.length >= 40) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function sourceUpdatedDate(updated: string | undefined): string | null {
  if (!updated) return null;
  const isoDate = updated.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (isoDate) return isoDate;
  const rocDate = updated.match(/民國\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!rocDate) return null;
  const year = Number(rocDate[1]) + 1911;
  const month = Number(rocDate[2]);
  const day = Number(rocDate[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function downloadSource(source: Source): Promise<string> {
  const response = await fetch(source.url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const bytes = new Uint8Array(await response.arrayBuffer());
  const looksPdf = contentType.includes('pdf') || source.url.toLowerCase().endsWith('.pdf') || (bytes[0] === 0x25 && bytes[1] === 0x50);

  if (looksPdf) {
    const pdf = await getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return cleanText(pages.join('\n\n'));
  }

  if (/\.docx?(?:$|[?#])/i.test(source.url) || contentType.includes('msword') || contentType.includes('wordprocessingml')) {
    throw new Error('目前只支援 PDF 與 HTML；此來源是 Word 文件，未下載或代填內容');
  }

  const html = new TextDecoder().decode(bytes);
  const mainText = html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1] ?? html;
  return cleanText(mainText);
}

async function createEmbedding(apiKey: string, model: string, input: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, dimensions: EMBEDDING_DIMENSIONS }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) throw new Error('Embedding 維度不符，預期 1536。');
  return embedding;
}

async function upsertSource(source: Source, text: string, hash: string, client: ReturnType<typeof createClient>, apiKey: string, embeddingModel: string): Promise<void> {
  const chunks = splitChunks(text);
  const vectors: Array<{ chunk_index: number; content: string; embedding: number[] }> = [];
  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + BATCH_SIZE);
    const embedded = await Promise.all(batch.map((content) => createEmbedding(apiKey, embeddingModel, content)));
    batch.forEach((content, index) => {
      const embedding = embedded[index];
      if (embedding) vectors.push({
        chunk_index: offset + index,
        content,
        embedding,
      });
    });
  }
  if (vectors.length === 0) throw new Error('文件未擷取到足夠文字，保留既有 chunks。');

  const { error } = await client.rpc('ingest_knowledge_document', {
    p_title: source.title,
    p_publisher: source.publisher,
    p_source_url: source.url,
    p_source_updated_at: sourceUpdatedDate(source.updated),
    p_content_hash: hash,
    p_chunks: vectors,
  });
  if (error) throw new Error(`文件與 chunks 原子寫入失敗：${error.message}`);
}

async function ingestOne(source: Source, client: ReturnType<typeof createClient>, apiKey: string, embeddingModel: string): Promise<void> {
  try {
    const text = await downloadSource(source);
    if (text.length < 80) throw new Error('擷取內容太短，跳過以避免以空/不完整內容覆蓋知識庫');
    const hash = createHash('sha256').update(text).digest('hex');
    const { data: existing, error } = await client
      .from('knowledge_documents')
      .select('id,content_hash')
      .eq('source_url', source.url)
      .maybeSingle();
    if (error) throw new Error(`文件狀態讀取失敗：${error.message}`);
    if (existing && (existing as DocumentRow).content_hash === hash) {
      console.info(`[unchanged] ${source.title}`);
      return;
    }
    await upsertSource(source, text, hash, client, apiKey, embeddingModel);
    console.info(`[ingested] ${source.title} (${text.length} chars)`);
  } catch (error) {
    console.error(`[skipped] ${source.title} ${source.url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
  for (const source of OFFICIAL_SOURCES) await ingestOne(source, client, apiKey, embeddingModel);
}

main().catch((error: unknown) => {
  console.error('[ingest] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
