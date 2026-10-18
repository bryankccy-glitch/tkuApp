/**
 * The Scriptable (https://scriptable.app) script for the iPhone home-screen widget.
 * iOS only lets App Store apps add widgets, so the free Scriptable app hosts ours: it fetches
 * /api/widget with the user's personal widget token and draws a small or medium widget in the style
 * of the system Weather widget. The token is embedded in the script the user copies — anyone with the
 * script can read that user's widget data, so it can be revoked/regenerated in 我的.
 */
export function buildWidgetScript(token: string, origin: string): string {
  return `// TKU Campus OS 桌面小工具（Scriptable）
// 由 ${origin} 產生。此腳本含你的個人小工具密鑰，請勿分享；可在 App「我的 → 桌面小工具」停用或重新產生。
const TOKEN = ${JSON.stringify(token)};
const ORIGIN = ${JSON.stringify(origin)};

const RED_TOP = new Color("#B3262D"), RED_BOTTOM = new Color("#7F1A1F");
const WHITE = Color.white(), SOFT = new Color("#FFFFFF", 0.72), FAINT = new Color("#FFFFFF", 0.5);
const WEEK = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];
const KIND = { homework: "作業", report: "報告", quiz: "小考", midterm: "期中考", final: "期末考", personal: "待辦" };

function symbolFor(code, isDay) {
  if (code === 0) return isDay ? "sun.max.fill" : "moon.stars.fill";
  if (code <= 2) return isDay ? "cloud.sun.fill" : "cloud.moon.fill";
  if (code === 3) return "cloud.fill";
  if (code === 45 || code === 48) return "cloud.fog.fill";
  if (code >= 51 && code <= 57) return "cloud.drizzle.fill";
  if (code >= 61 && code <= 67) return "cloud.rain.fill";
  if (code >= 80 && code <= 82) return "cloud.heavyrain.fill";
  if (code >= 95) return "cloud.bolt.rain.fill";
  if (code >= 71 && code <= 86) return "cloud.snow.fill";
  return "cloud.fill";
}

function dueLabel(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.round(ms / 3600000);
  if (h < 1) return "1 小時內";
  if (h < 24) return h + " 小時後";
  return Math.round(h / 24) + " 天後";
}

function whenLabel(next, weekday) {
  if (next.status === "now") return "上課中";
  if (next.dayOffset === 0) return "今天";
  if (next.dayOffset === 1) return "明天";
  return WEEK[((weekday - 1 + next.dayOffset) % 7) + 1];
}

function text(stack, value, size, color, weight) {
  const t = stack.addText(value);
  t.font = weight === "bold" ? Font.boldSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

async function load() {
  const req = new Request(ORIGIN + "/api/widget");
  req.headers = { Authorization: "Bearer " + TOKEN };
  req.timeoutInterval = 10;
  const data = await req.loadJSON();
  if (req.response.statusCode !== 200) throw new Error(data && data.error ? data.error : "暫時無法讀取資料");
  return data;
}

function weatherBlock(stack, w, big) {
  const col = stack.addStack();
  col.layoutVertically();
  if (!w) { text(col, "—", big ? 30 : 20, WHITE, "semibold"); return; }
  const row = col.addStack();
  row.centerAlignContent();
  const sym = SFSymbol.named(symbolFor(w.code, w.isDay));
  if (sym) { const img = row.addImage(sym.image); img.imageSize = new Size(big ? 20 : 16, big ? 20 : 16); img.tintColor = WHITE; row.addSpacer(4); }
  text(row, w.temperature + "°", big ? 30 : 22, WHITE, "semibold");
  text(col, "高 " + w.max + "°  低 " + w.min + "°", 11, SOFT, "semibold");
}

function build(data) {
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [RED_TOP, RED_BOTTOM];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(14, 16, 12, 16);
  w.url = ORIGIN + "/";
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  const top = w.addStack();
  top.layoutHorizontally();
  const left = top.addStack();
  left.layoutVertically();
  const n = data.next;
  text(left, n ? "下一堂課 · " + whenLabel(n, data.weekday) : "下一堂課", 12, SOFT, "semibold");
  left.addSpacer(2);
  text(left, n ? n.name : "這週沒有課", family === "small" ? 18 : 22, WHITE, "bold");
  if (n) text(left, n.start + "–" + n.end + (n.room ? " · " + n.room : ""), 13, SOFT, "semibold");
  top.addSpacer();
  weatherBlock(top, data.weather, family !== "small");

  if (family === "small") {
    w.addSpacer();
    if (data.task) text(w, (KIND[data.task.kind] || "待辦") + " · " + dueLabel(data.task.dueAt), 11, SOFT, "semibold");
    return w;
  }

  w.addSpacer(6);
  if (data.task) {
    const t = data.task;
    text(w, "📌 " + (KIND[t.kind] || "待辦") + "：" + t.title + (t.course ? "（" + t.course + "）" : "") + " · " + dueLabel(t.dueAt), 11, SOFT, "semibold");
  }
  w.addSpacer();

  const row = w.addStack();
  row.layoutHorizontally();
  const today = (data.today || []).slice(0, 4);
  if (!today.length) {
    text(row, "今天沒有課 🎉", 13, SOFT, "semibold");
  } else {
    today.forEach((c, i) => {
      if (i) row.addSpacer();
      const cell = row.addStack();
      cell.layoutVertically();
      text(cell, c.start, 11, FAINT, "semibold");
      text(cell, c.name.length > 5 ? c.name.slice(0, 5) + "…" : c.name, 13, WHITE, "semibold");
    });
    if (today.length < 4) row.addSpacer();
  }
  return w;
}

function errorWidget(message) {
  const w = new ListWidget();
  w.backgroundColor = RED_BOTTOM;
  text(w, "TKU Campus OS", 13, WHITE, "bold");
  w.addSpacer(4);
  const t = w.addText(message);
  t.font = Font.systemFont(12);
  t.textColor = SOFT;
  w.url = ORIGIN + "/me";
  return w;
}

let widget;
try {
  widget = build(await load());
} catch (e) {
  widget = errorWidget(String(e && e.message ? e.message : e));
}
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
