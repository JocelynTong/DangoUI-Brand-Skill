// Runs before rendering; shared by the shell and same-origin inspector frames.
(() => {
  const key = 'dangoui-site-theme';
  const media = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch {}
  function apply() {
    document.documentElement.dataset.siteTheme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.themePreference = preference;
    window.dispatchEvent(new Event('site-theme-change'));
  }
  window.siteTheme = {
    get: () => preference,
    set(value) {
      if (!valid(value)) return;
      preference = value;
      try { localStorage.setItem(key, value); } catch {}
      apply();
    },
  };
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  apply();
})();
