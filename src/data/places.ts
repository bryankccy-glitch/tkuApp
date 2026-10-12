/**
 * 淡江大學淡水校園空間代碼。
 *
 * 查核狀態（2026-10-12）：
 * - 代碼與名稱：來自學生社群整理之代碼表（1111 大學網），待與校方公開資料逐筆核對。
 * - T 驚聲紀念大樓：來源誤植為「驚生」，依校內常見名稱修正，待核對。
 * - 個別建築座標：尚未取得可信來源，一律為 null，不在地圖上標記。
 * - 校園中心座標：Wikipedia「Tamkang University」條目（25.175, 121.449）。
 */
// Plain data only — also imported by the server functions in api/, so no app-only imports here.

export type PlaceCategory = 'academic' | 'library' | 'admin' | 'sports' | 'culture' | 'service' | 'gate' | 'other';

export interface CampusPlace {
  code: string;
  name: string;
  category: PlaceCategory;
  /** Only set when verified against a trustworthy source. */
  coords: { lat: number; lng: number } | null;
  source: { name: string; url: string };
  verified: boolean;
  note?: string;
}


const CODE_SOURCE = {
  name: '淡江教室代碼整理（1111 大學網，學生社群）',
  url: 'https://university.1111.com.tw/zone/University/discussTopic.asp?cat=University&id=270024',
};

export const CAMPUS_CENTER = {
  lat: 25.175,
  lng: 121.449,
  source: { name: 'Wikipedia: Tamkang University', url: 'https://en.wikipedia.org/wiki/Tamkang_University' },
  address: '25137 新北市淡水區英專路 151 號',
};

const p = (code: string, name: string, category: PlaceCategory, note?: string): CampusPlace => ({
  code, name, category, coords: null, source: CODE_SOURCE, verified: false, note,
});

export const CAMPUS_PLACES: CampusPlace[] = [
  p('A', '行政大樓', 'admin'),
  p('B', '商管大樓', 'academic'),
  p('C', '鍾靈化學館', 'academic'),
  p('E', '工學大樓', 'academic'),
  p('ED', '教育館', 'academic'),
  p('F', '會文館', 'academic'),
  p('FL', '外國語文大樓', 'academic'),
  p('G', '工學館', 'academic'),
  p('H', '宮燈教室', 'academic', '淡江最具代表性的建築群'),
  p('HC', '守謙國際會議中心', 'culture'),
  { ...p('I', '覺生綜合大樓', 'academic'), source: { name: '淡江大學遠距教學發展中心', url: 'https://deds.tku.edu.tw/room/' } },
  p('J', '麗澤國際學舍', 'service'),
  p('K', '建築館', 'academic'),
  p('L', '文學館', 'academic'),
  p('M', '海事博物館', 'culture'),
  p('N', '紹謨紀念游泳館', 'sports'),
  p('O', '傳播館', 'academic', '傳播館代碼包含 O 與 Q'),
  p('Q', '傳播館', 'academic', '傳播館代碼包含 O 與 Q'),
  p('R', '活動中心', 'service'),
  p('S', '騮先紀念科學館', 'academic'),
  p('SG', '紹謨紀念體育館', 'sports'),
  p('T', '驚聲紀念大樓', 'academic', '來源誤植為「驚生」，名稱待核對'),
  p('U', '覺生紀念圖書館', 'library'),
  p('V', '視聽教育館', 'academic'),
  p('Z', '松濤館', 'service'),
  p('P', '司令台', 'other'),
  p('RT', '網球場', 'sports'),
  p('SS', '溜冰場', 'sports'),
  p('GA', '大門管制站', 'gate'),
];

/** Extracts the building code from a room string like "E304", "FL105", "HC306". */
export function buildingFromRoom(room: string): CampusPlace | undefined {
  const m = room.trim().toUpperCase().match(/^([A-Z]{1,2})/);
  if (!m) return undefined;
  const letters = m[1]!;
  return CAMPUS_PLACES.find((pl) => pl.code === letters) ?? CAMPUS_PLACES.find((pl) => pl.code === letters[0]);
}

/** "B217" → "B217 · 商管大樓" so people know which building to walk to; unknown codes stay as-is. */
export function roomWithBuilding(room: string): string {
  const r = room.trim();
  if (!r) return r;
  const b = buildingFromRoom(r);
  return b ? `${r} · ${b.name}` : r;
}

/** External navigation without fabricated coordinates: Google Maps search by name. */
export function mapsSearchUrl(place: Pick<CampusPlace, 'name' | 'coords'>): string {
  if (place.coords) return `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`淡江大學 ${place.name}`)}`;
}
