// Applies the saved theme before first paint (kept out of index.html so the CSP needs no inline scripts).
try {
  var t = localStorage.getItem('tku.theme');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  var l = localStorage.getItem('tku.lang');
  if (l === 'en') document.documentElement.lang = 'en';
} catch (e) {}
