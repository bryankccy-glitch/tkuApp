/**
 * 淡江大學淡水校園空間代碼。
 *
 * 查核狀態（2026-10-12）：
 * - 代碼與名稱：來自學生社群整理之代碼表（1111 大學網），待與校方公開資料逐筆核對。
 * - T 驚聲紀念大樓：來源誤植為「驚生」，依校內常見名稱修正，待核對。
 * - 個別建築座標（2026-10-20）：OpenStreetMap 校園建物圖資（Overpass 查詢，建物輪廓中心點），
 *   每筆附 OSM way 編號；宮燈教室為 6 棟中心點平均、松濤館標 1 館、司令台取校內操場旁那座。
 *   OSM 為社群編輯（ODbL），位置可能有數公尺誤差；名稱以 OSM 核對過（T 驚聲紀念大樓、ED 在 OSM 作「教育大樓」）。
 * - 校園中心座標：Wikipedia「Tamkang University」條目（25.175, 121.449）。
 */
// Plain data only — also imported by the server functions in api/, so no app-only imports here.

export type PlaceCategory = 'academic' | 'library' | 'admin' | 'sports' | 'culture' | 'service' | 'gate' | 'other';

export interface CampusPlace {
  code: string;
  name: string;
  category: PlaceCategory;
  /** Only set when taken from a citable source (coordsSource). */
  coords: { lat: number; lng: number } | null;
  coordsSource?: { name: string; url: string };
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

/** Building outline centres from OpenStreetMap (way ids), see header. */
const OSM: Record<string, [number, number, string]> = {"A": [25.174772, 121.449117, "235418117"], "B": [25.176571, 121.450093, "292253711"], "C": [25.175259, 121.448892, "235418085"], "E": [25.176003, 121.451762, "235418107"], "ED": [25.175807, 121.452657, "235418109"], "F": [25.175745, 121.449614, "235418091"], "FL": [25.174829, 121.451684, "235418154"], "G": [25.17616, 121.45108, "235418104"], "H": [25.174228, 121.448625, "235418122"], "HC": [25.174813, 121.447876, "964267202"], "I": [25.174328, 121.450935, "235418151"], "J": [25.176219, 121.447755, "235418071"], "K": [25.176438, 121.451043, "294126064"], "L": [25.176218, 121.449414, "285904595"], "M": [25.176184, 121.450415, "235418097"], "N": [25.174575, 121.447202, "235413781"], "O": [25.175641, 121.449119, "235418089"], "Q": [25.175641, 121.449119, "235418089"], "R": [25.17466, 121.450284, "235418142"], "S": [25.175449, 121.448153, "235418066"], "SG": [25.176128, 121.448612, "964229634"], "T": [25.175466, 121.451311, "235418157"], "U": [25.174746, 121.45097, "235418149"], "V": [25.174988, 121.449447, "235418115"], "Z": [25.174583, 121.451752, "235418156"], "P": [25.17395, 121.445665, "964270669"], "RT": [25.175033, 121.449782, "235418113"], "SS": [25.175528, 121.447613, "446753144"], "GA": [25.173847, 121.447109, "971523384"]};
export const COORDS_SOURCE = { name: 'OpenStreetMap contributors（ODbL）', url: 'https://www.openstreetmap.org/' };

const p = (code: string, name: string, category: PlaceCategory, note?: string): CampusPlace => {
  const c = OSM[code];
  return {
    code, name, category, source: CODE_SOURCE, verified: false, note,
    coords: c ? { lat: c[0], lng: c[1] } : null,
    ...(c ? { coordsSource: { name: COORDS_SOURCE.name, url: `https://www.openstreetmap.org/way/${c[2]}` } } : {}),
  };
};

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
  p('T', '驚聲紀念大樓', 'academic', '原代碼表誤植為「驚生」，已依 OpenStreetMap 核對為驚聲'),
  p('U', '覺生紀念圖書館', 'library'),
  p('V', '視聽教育館', 'academic'),
  p('Z', '松濤館', 'service', '學生宿舍，共 1–5 館；地圖標示 1 館'),
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
