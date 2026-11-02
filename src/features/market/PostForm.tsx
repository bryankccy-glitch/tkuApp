import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, ShieldCheck, X } from 'lucide-react';
import { useRulesAccepted, useSocial } from '@/lib/social/hooks';
import { downscaleToJpeg } from '@/lib/images';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/misc';
import {
  MARKET_CATEGORIES, MARKET_CONDITIONS, MARKET_RULES_VERSION, type MarketCategory, type MarketCondition, type MarketKind, type MarketPost, type MarketPostInput,
} from '@/lib/social/types';
import { t } from '@/i18n/t';

const MAX_PHOTOS = 4;

export function RulesList() {
  return (
    <>
      <ul className="list-disc space-y-0.5 pl-5 text-label text-muted">
        <li>{t('market.rules.noMoney')}</li>
        <li>{t('market.rules.meetSafely')}</li>
        <li>{t('market.rules.noPiracy')}</li>
        <li>{t('market.rules.noProhibited')}</li>
        <li>{t('market.rules.privacy')}</li>
      </ul>
      <Link to="/terms" className="mt-1.5 inline-block text-label font-semibold text-link hover:underline">{t('safety.rulesTerms')}</Link>
    </>
  );
}

/** Create / edit a 二手市集 post. Price is a reference only — the app never handles money. */
export function PostForm({ open, onClose, onSubmit, saving, initial }: {
  open: boolean; onClose: () => void; onSubmit: (v: MarketPostInput) => Promise<void> | void; saving?: boolean; initial?: MarketPost | null;
}) {
  const [kind, setKind] = useState<MarketKind>('sell');
  const [category, setCategory] = useState<MarketCategory>('book');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [condition, setCondition] = useState<MarketCondition | ''>('');
  const accepted = useRulesAccepted();
  const [agree, setAgree] = useState(false);
  const canAdd = agree || accepted.data === true;
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const social = useSocial();
  // Files uploaded in this form and not yet saved, and saved files the user removed.
  const fresh = useRef<string[]>([]);
  const removed = useRef<string[]>([]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !social) return;
    setError(null);
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room);
      const urls: string[] = [];
      for (const f of picked) urls.push(await social.uploadMarketPhoto(await downscaleToJpeg(f)));
      fresh.current.push(...urls);
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setError(t('market.form.photoFailed'));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? 'sell');
    setCategory(initial?.category ?? 'book');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setPrice(initial?.price != null ? String(initial.price) : '');
    setCourseCode(initial?.courseCode ?? '');
    setCondition(initial?.condition ?? '');
    setPhotos(initial?.photos ?? []);
    fresh.current = [];
    removed.current = [];
    setError(null);
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const tt = title.trim();
    if (tt.length < 2 || tt.length > 80) return setError(t('market.form.titleInvalid'));
    if (description.length > 2000) return setError(t('market.form.descTooLong'));
    let p: number | null = null;
    if (price.trim() !== '') {
      const n = Number(price);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return setError(t('market.form.priceInvalid'));
      p = n;
    }
    if (!canAdd) return setError(t('market.form.mustAgree'));
    if (accepted.data !== true) await social?.acceptRules(MARKET_RULES_VERSION).catch(() => undefined);
    await onSubmit({
      kind, category, title: tt, description: description.trim(), price: p,
      courseCode: courseCode.trim() || null, condition: kind === 'sell' && condition ? condition : null,
      photos,
    });
    fresh.current = [];
    const gone = removed.current;
    removed.current = [];
    if (gone.length) void social?.removeMarketPhotos(gone).catch(() => undefined);
  };

  const removePhoto = (url: string) => {
    setPhotos((p) => p.filter((x) => x !== url));
    if (fresh.current.includes(url)) {
      fresh.current = fresh.current.filter((x) => x !== url);
      void social?.removeMarketPhotos([url]).catch(() => undefined);
    } else removed.current.push(url);
  };

  const cancel = () => {
    if (fresh.current.length) void social?.removeMarketPhotos(fresh.current).catch(() => undefined);
    fresh.current = [];
    removed.current = [];
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={cancel}
      title={initial ? t('market.form.editTitle') : t('market.form.newTitle')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={cancel}>{t('common.cancel')}</Button>
          <Button type="submit" form="market-form" className="flex-1" loading={saving} disabled={uploading}>{initial ? t('common.save') : t('market.form.publish')}</Button>
        </>
      }
    >
      <form id="market-form" onSubmit={submit} noValidate className="grid gap-3.5">
        <Segmented<MarketKind>
          label={t('market.form.kind')}
          className="[&>button]:flex-1 [&>button]:justify-center"
          value={kind}
          onChange={setKind}
          options={[{ value: 'sell', label: t('market.form.kindSell') }, { value: 'want', label: t('market.form.kindWant') }]}
        />
        <div>
          <label className="label" htmlFor="mk-title">{t('market.form.title')}</label>
          <input id="mk-title" className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'sell' ? t('market.form.titlePhSell') : t('market.form.titlePhWant')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="mk-cat">{t('market.form.category')}</label>
            <select id="mk-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value as MarketCategory)}>
              {MARKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`market.category.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mk-price">{kind === 'sell' ? t('market.form.price') : t('market.form.budget')}</label>
            <input id="mk-price" className="field" inputMode="numeric" placeholder={t('market.form.pricePh')} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} aria-describedby="mk-price-hint" />
          </div>
        </div>
        <p id="mk-price-hint" className="-mt-2 text-label text-muted">{t('market.form.priceHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="mk-course">{t('market.form.courseCode')} <span className="font-normal">· {t('common.optional')}</span></label>
            <input id="mk-course" className="field uppercase" maxLength={20} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder={t('market.form.courseCodePh')} />
          </div>
          {kind === 'sell' && (
            <div>
              <label className="label" htmlFor="mk-cond">{t('market.form.condition')}</label>
              <select id="mk-cond" className="field" value={condition} onChange={(e) => setCondition(e.target.value as MarketCondition | '')}>
                <option value="">{t('market.form.conditionUnset')}</option>
                {MARKET_CONDITIONS.map((c) => <option key={c} value={c}>{t(`market.condition.${c}`)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="mk-desc">{t('market.form.description')}</label>
          <textarea id="mk-desc" className="field min-h-[96px]" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('market.form.descriptionPh')} />
        </div>

        <div>
          <p className="label">{t('market.form.photos')} <span className="font-normal">· {t('market.form.photosHint', { count: MAX_PHOTOS })}</span></p>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-sm border border-line bg-sunken">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removePhoto(url)} aria-label={t('market.form.photoRemove')}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-line text-label text-muted hover:bg-sunken">
                <ImagePlus className="h-5 w-5" aria-hidden />
                {uploading ? t('market.form.photoUploading') : t('market.form.photoAdd')}
                <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading || !canAdd} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>

        <div className="rounded-sm border border-line bg-sunken p-3">
          <p className="flex items-center gap-1.5 text-caption font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-primary" />{t('market.rules.title')}</p>
          <div className="mt-1.5"><RulesList /></div>
          <label className="mt-2.5 flex items-center gap-2 text-caption font-semibold text-ink">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" checked={canAdd} disabled={accepted.data === true} onChange={(e) => setAgree(e.target.checked)} />
            {t('market.rules.agree')}
          </label>
        </div>

        {!canAdd && <p className="text-label text-muted">{t('safety.rulesPhoto')}</p>}
        {error && <p role="alert" className="text-caption text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}
