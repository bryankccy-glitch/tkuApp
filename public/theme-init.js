// Applies the saved theme before first paint (kept out of index.html so the CSP needs no inline scripts).
try {
  var t = localStorage.getItem('tku.theme');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  var l = localStorage.getItem('tku.lang');
  if (l && l !== 'zh-TW') {
    document.documentElement.lang = l === 'zh-CN' ? 'zh-Hans-CN' : l;
    if (l === 'ar' || l === 'fa' || l === 'he') document.documentElement.dir = 'rtl';
  }
} catch (e) {}
// Same as src/lib/startupImage.ts, as early as possible: launch screen follows the app's own theme.
try {
  var pref = localStorage.getItem('tku.theme');
  if (pref === 'light' || pref === 'dark') {
    var links = document.querySelectorAll('link[rel="apple-touch-startup-image"]');
    for (var i = 0; i < links.length; i++) {
      var ln = links[i];
      ln.dataset.media = ln.getAttribute('media') || '';
      ln.dataset.href = ln.getAttribute('href') || '';
      ln.setAttribute('media', (ln.getAttribute('media') || '').replace(/\s*and\s*\(prefers-color-scheme:\s*(light|dark)\)/, ''));
      ln.setAttribute('href', (ln.getAttribute('href') || '').replace(/\/splash\/(light|dark)-/, '/splash/' + pref + '-'));
    }
  }
} catch (e) {}
