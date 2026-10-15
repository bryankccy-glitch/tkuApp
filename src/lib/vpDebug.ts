/**
 * TEMPORARY diagnostic panel for the iOS home-screen keyboard/viewport bug (remove once fixed).
 * Opened by tapping the AI assistant title 5 times quickly. Shows live viewport numbers and buttons
 * that try different ways to make WebKit re-measure the viewport.
 */
let panel: HTMLDivElement | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const log: string[] = [];

function metrics() {
  const vv = window.visualViewport;
  const fixed = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  return [
    `inner ${window.innerWidth}×${window.innerHeight}  outer ${window.outerHeight}`,
    `vv h ${vv?.height.toFixed(1)} top ${vv?.offsetTop.toFixed(1)} scale ${vv?.scale}`,
    `screen ${screen.width}×${screen.height}  docEl ${document.documentElement.clientHeight}`,
    `scrollY ${window.scrollY}  nav bottom ${fixed ? fixed.bottom.toFixed(1) : '-'}`,
    `standalone ${(navigator as Navigator & { standalone?: boolean }).standalone}`,
  ].join('\n');
}

const tries: Record<string, () => void> = {
  'A root display': () => { const r = document.getElementById('root')!; r.style.display = 'none'; void r.offsetHeight; r.style.display = ''; },
  'B meta viewport': () => {
    const m = document.querySelector('meta[name=viewport]')!; const c = m.getAttribute('content')!;
    m.setAttribute('content', c.replace('viewport-fit=cover', 'viewport-fit=auto'));
    requestAnimationFrame(() => m.setAttribute('content', c));
  },
  'C scroll 1/0': () => { window.scrollTo(0, 1); requestAnimationFrame(() => window.scrollTo(0, 0)); },
  'D html 100lvh': () => { const s = document.documentElement.style; s.height = s.height ? '' : '100lvh'; },
  'E focus/blur': () => {
    const i = document.createElement('input'); i.readOnly = true; i.style.cssText = 'position:fixed;top:0;opacity:0;font-size:16px';
    document.body.appendChild(i); i.focus(); setTimeout(() => { i.blur(); i.remove(); }, 50);
  },
  'F body fixed': () => { const s = document.body.style; s.position = 'fixed'; s.inset = '0'; void document.body.offsetHeight; s.position = ''; s.inset = ''; },
  'G html display': () => { const h = document.documentElement; h.style.display = 'none'; void h.offsetHeight; h.style.display = ''; },
};

function render() {
  if (!panel) return;
  const pre = panel.querySelector('pre')!;
  pre.textContent = `${metrics()}\n— ${log.slice(-4).join('\n— ')}`;
}

export function toggleVpDebug() {
  if (panel) { panel.remove(); panel = null; clearInterval(timer); return; }
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 56px);z-index:9999;background:rgba(0,0,0,.82);color:#0f0;font:11px/1.35 ui-monospace,monospace;padding:8px;border-radius:8px;-webkit-user-select:text;user-select:text';
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0 0 6px;white-space:pre-wrap';
  panel.appendChild(pre);
  for (const [name, fn] of Object.entries(tries)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.style.cssText = 'margin:2px;padding:6px 8px;background:#333;color:#fff;border-radius:6px;font:11px ui-monospace,monospace';
    b.onclick = () => { const before = window.innerHeight; fn(); setTimeout(() => { log.push(`${name}: ${before}→${window.innerHeight}`); render(); }, 400); };
    panel.appendChild(b);
  }
  document.body.appendChild(panel);
  render();
  timer = setInterval(render, 500);
}

let taps: number[] = [];
export function vpDebugTap() {
  const now = Date.now();
  taps = [...taps.filter((t) => now - t < 2000), now];
  if (taps.length >= 5) { taps = []; toggleVpDebug(); }
}
