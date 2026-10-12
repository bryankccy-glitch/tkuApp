import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Navigation, Search, X, Megaphone, ShieldAlert } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { CAMPUS_CENTER, CAMPUS_PLACES, PLACE_CATEGORY_LABELS, mapsSearchUrl, type CampusPlace, type PlaceCategory } from '@/data/places';
import { cn } from '@/lib/cn';

const CampusMap = lazy(() => import('./CampusMap'));

const CATS: ('all' | PlaceCategory)[] = ['all', 'academic', 'library', 'admin', 'culture', 'sports', 'service', 'gate', 'other'];

export function searchPlaces(q: string, cat: 'all' | PlaceCategory): CampusPlace[] {
  const s = q.trim().toUpperCase();
  return CAMPUS_PLACES.filter((p) => (cat === 'all' || p.category === cat)).filter((p) => {
    if (!s) return true;
    const roomCode = s.match(/^([A-Z]{1,2})\d/)?.[1];
    return p.code === s || p.code === roomCode || p.name.toUpperCase().includes(s);
  });
}

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState<'all' | PlaceCategory>('all');
  const selectedCode = params.get('place');
  const selected = CAMPUS_PLACES.find((p) => p.code === selectedCode) ?? null;
  const results = useMemo(() => searchPlaces(q, cat), [q, cat]);

  const select = (p: CampusPlace | null) => {
    if (p) params.set('place', p.code); else params.delete('place');
    setParams(params, { replace: true });
  };

  return (
    <Page wide>
      <PageHeader
        title="校園探索"
        subtitle="淡水校園建築與教室代碼。輸入教室（例如 E304）可直接找到所在大樓。"
        actions={<Link to="/events" className="inline-flex h-8 items-center gap-1.5 rounded-xs border border-line px-3 text-caption font-semibold text-ink hover:bg-sunken"><Megaphone className="h-4 w-4" />活動與機會</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="place-q" className="sr-only">搜尋建築或教室</label>
            <input id="place-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋建築名稱、代碼或教室" className="field pl-9" />
            {q && <button type="button" aria-label="清除搜尋" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs p-1 text-muted hover:text-ink"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="分類篩選">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                className={cn('h-8 shrink-0 rounded-full border px-3 text-caption font-semibold', cat === c ? 'border-primary bg-primary text-white dark:text-[#2A0E0C]' : 'border-line text-muted hover:text-ink')}
              >
                {c === 'all' ? '全部' : PLACE_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState compact title="找不到符合的建築" body="試試建築代碼（例如 FL）或名稱關鍵字。" />
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
              {results.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    onClick={() => select(p)}
                    aria-current={selected?.code === p.code}
                    className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken', selected?.code === p.code && 'bg-primary/[0.06]')}
                  >
                    <span className="tabular flex h-9 w-11 shrink-0 items-center justify-center rounded-xs bg-primary/[0.08] text-body font-bold text-primary">{p.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">{p.name}</span>
                      <span className="block text-caption text-muted">{PLACE_CATEGORY_LABELS[p.category]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="order-1 grid content-start gap-4 lg:order-2">
          <div className="relative h-64 overflow-hidden rounded-lg border border-line bg-sunken sm:h-80 lg:h-[26rem]">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-caption text-muted">地圖載入中…</div>}>
              <CampusMap places={CAMPUS_PLACES} selected={selected} />
            </Suspense>
          </div>

          {selected ? (
            <PlaceDetail place={selected} onClose={() => select(null)} />
          ) : (
            <p className="text-caption text-muted">
              地圖中心為淡江大學淡水校園（{CAMPUS_CENTER.address}）。各建築精確座標仍在查核中，查核完成前不會標記在地圖上，避免帶錯路。
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}

function PlaceDetail({ place, onClose }: { place: CampusPlace; onClose: () => void }) {
  return (
    <section aria-labelledby="place-title" className="relative rounded-lg border border-line bg-surface p-5">
      <button type="button" onClick={onClose} aria-label="關閉建築詳情" className="absolute right-3 top-3 rounded-xs p-1.5 text-muted hover:bg-sunken hover:text-ink"><X className="h-4 w-4" /></button>
      <p className="tabular text-caption font-semibold text-heritage">代碼 {place.code}</p>
      <h2 id="place-title" className="mt-0.5 text-h2 text-ink">{place.name}</h2>
      <p className="mt-1 text-caption text-muted">{PLACE_CATEGORY_LABELS[place.category]}{place.note ? `｜${place.note}` : ''}</p>
      <p className="mt-3 text-body text-muted">教室編號以 {place.code} 開頭的課程（例如 {place.code}101）在這棟建築。</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={mapsSearchUrl(place)} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-caption font-semibold text-white dark:text-[#2A0E0C]">
          <Navigation className="h-4 w-4" />在 Google 地圖導航
        </a>
      </div>
      <div className="mt-4 flex gap-2 rounded-sm bg-sunken p-3 text-[12px] text-muted">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          {place.verified ? '資料已查核。' : '名稱與代碼來自學生整理的資料，尚待與校方公開資料核對；座標尚未標記。'}
          來源：<a href={place.source.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">{place.source.name}<ExternalLink className="h-3 w-3" /></a>
        </p>
      </div>
    </section>
  );
}
