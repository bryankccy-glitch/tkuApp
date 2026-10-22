import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Dev only: serves the Vercel functions in `api/` from `npm run dev`, so features such as
 * 圖片匯入課表 and the AI assistant can be tried locally before deploying.
 *
 * Server-only secrets come from `.env.local` (never `VITE_`-prefixed, never sent to the browser):
 *   SUPABASE_SERVICE_ROLE_KEY=…   GEMINI_API_KEY=…
 * SUPABASE_URL / SUPABASE_ANON_KEY default to the public VITE_ values.
 * Without the secrets the endpoints answer 503 and the app shows its normal fallback.
 */
const ROUTES: Record<string, string> = {
  '/api/chat': '/api/chat.ts',
  '/api/push': '/api/push.ts',
};
const MAX_BODY = 4_500_000; // same limit as Vercel

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Adds the few Vercel helpers our handlers use on top of Node's request/response. */
function vercelify(res: ServerResponse) {
  const r = res as ServerResponse & { status: (code: number) => typeof r; json: (body: unknown) => void };
  r.status = (code: number) => { res.statusCode = code; return r; };
  r.json = (body: unknown) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  return r;
}

export function devApi(): Plugin {
  return {
    name: 'tku-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      const set = (key: string, value: string | undefined) => { if (value && !process.env[key]) process.env[key] = value; };
      for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_EMBEDDING_MODEL', 'AI_RATE_LIMIT_PER_MINUTE', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'CRON_SECRET']) set(key, env[key]);
      set('SUPABASE_URL', env.VITE_SUPABASE_URL);
      set('SUPABASE_ANON_KEY', env.VITE_SUPABASE_ANON_KEY);

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        const file = ROUTES[path];
        if (!file) return next();
        try {
          const raw = req.method === 'POST' ? await readBody(req) : '';
          const mod = await server.ssrLoadModule(file) as { default: (req: unknown, res: unknown) => Promise<void> };
          const request = Object.assign(req, { body: raw ? (() => { try { return JSON.parse(raw) as unknown; } catch { return raw; } })() : undefined });
          await mod.default(request, vercelify(res));
        } catch (error) {
          server.config.logger.error(`[dev-api] ${path}: ${error instanceof Error ? error.message : String(error)}`);
          if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'dev api error' })); }
        }
      });
    },
  };
}
