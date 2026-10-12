import { ExternalLink } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/misc';
import { Wordmark } from '@/components/brand/Logo';
import { OFFICIAL_SOURCES } from '@/data/sources';
import { PERIOD_SOURCE } from '@/lib/periods';
import { CAMPUS_CENTER } from '@/data/places';

export default function AboutPage() {
  return (
    <Page>
      <PageHeader title="關於 TKU Campus OS" />
      <div className="rounded-lg border border-line bg-surface p-5">
        <Wordmark />
        <p className="mt-4 text-body text-ink">讓校園生活更簡單、更智慧、更有連結。</p>
        <p className="mt-3 text-body text-muted">
          TKU Campus OS 是淡江學生自主開發的第三方平台，<strong className="text-ink">不是淡江大學官方 App</strong>，也未取得學校授權。
          介面色彩為設計提案，不代表學校官方標準色；標誌為原創設計，未使用淡江校徽。
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-h3 text-ink">隱私</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-body text-muted">
          <li>我們不會要求、也不會儲存淡江校務系統的帳號密碼。</li>
          <li>本機模式下，所有資料只存在你的瀏覽器。</li>
          <li>雲端模式下，資料庫以列級安全（RLS）限制每位使用者只能存取自己的資料。</li>
          <li>你可以隨時在「我的」匯出資料或刪除帳號。</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 text-ink">資料來源與查核狀態</h2>
        <p className="mt-1 text-caption text-muted">最後查核：2026 年 10 月 12 日</p>
        <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">上課節次時間</span>：<a className="text-blue hover:underline" href={PERIOD_SOURCE.url} target="_blank" rel="noreferrer noopener">{PERIOD_SOURCE.name}</a></li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">建築代碼</span>：學生社群整理資料，尚待與校方公開資料核對</li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">校園位置</span>：<a className="text-blue hover:underline" href={CAMPUS_CENTER.source.url} target="_blank" rel="noreferrer noopener">{CAMPUS_CENTER.source.name}</a>；個別建築座標尚未查核</li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">地圖圖資</span>：© OpenStreetMap contributors</li>
        </ul>
        <h3 className="mt-5 text-body font-semibold text-ink">官方文件與服務連結</h3>
        <ul className="mt-2 grid gap-1.5">
          {OFFICIAL_SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-body text-blue hover:underline">{s.title}<ExternalLink className="h-3.5 w-3.5" /></a>
              <span className="ml-2 text-caption text-muted">{s.publisher}{s.updated ? `｜${s.updated}` : ''}</span>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
