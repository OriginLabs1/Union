/* Union site — small, dependency-free interactions. */

(() => {
  const doc = document.documentElement;
  const head = document.getElementById('site-head');
  const menuBtn = document.getElementById('menu-btn');
  const nav = document.getElementById('nav');
  const themeBtn = document.getElementById('theme-toggle');

  /* theme ------------------------------------------------------------- */

  const stored = (() => {
    try { return localStorage.getItem('union-theme'); } catch { return null; }
  })();
  if (stored === 'light' || stored === 'dark') doc.dataset.theme = stored;
  else if (!doc.dataset.theme) {
    doc.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const themeColor = () => document.querySelector('meta[name="theme-color"]:not([media])');
  const paint = () => {
    const meta = themeColor();
    if (!meta) return;
    meta.setAttribute('content', doc.dataset.theme === 'dark' ? '#101116' : '#f4f1ea');
  };
  paint();

  themeBtn?.addEventListener('click', () => {
    const next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.dataset.theme = next;
    try { localStorage.setItem('union-theme', next); } catch {}
    paint();
  });

  /* header + menu ------------------------------------------------------ */

  const onScroll = () => head?.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    if (!nav || !menuBtn) return;
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menuBtn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${open ? 'i-close' : 'i-menu'}"/></svg>`;
  };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  addEventListener('resize', () => {
    if (innerWidth > 760 && nav?.classList.contains('open')) setMenu(false);
  });

  /* reveal on scroll --------------------------------------------------- */

  const items = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (const item of items) io.observe(item);
  } else {
    for (const item of items) item.classList.add('in');
  }

  /* screen tour -------------------------------------------------------- */

  const tour = {
    home: {
      eyebrow: 'Home',
      title: 'A card, not a feed.',
      text: 'The first screen is your identity card and the next useful step. Badges are evidence of practice. There is no timeline to keep up with.'
    },
    messages: {
      eyebrow: 'Messages',
      title: 'Sealed before they leave.',
      text: 'A note is encrypted on this device, then handed to an optional relay. The delivery state is shown plainly: queued, sent, delivered or failed. No read receipts were invented.'
    },
    communities: {
      eyebrow: 'Communities',
      title: 'A room with a stated purpose.',
      text: 'Every room states its purpose before you join. Public rooms can sync through a relay; private rooms stay local until the people in them agree on another path.'
    },
    learning: {
      eyebrow: 'Learning',
      title: 'Practice, not completion.',
      text: 'Short lessons, questions and exercises. Progress lives on the device and is never used to rank you against anyone else.'
    },
    economy: {
      eyebrow: 'Economy',
      title: 'Records are real. Money is not, yet.',
      text: 'Activation, giving and coordination are recorded in a hash-chained local ledger. Version 0.1.0 is test mode, and every economic screen says so.'
    },
    ai: {
      eyebrow: 'Union AI',
      title: 'It proposes. You decide.',
      text: 'The assistant can read your local context, remember what you allow, and draft actions. Nothing changes until you approve it. Remote providers are optional and configured by you.'
    }
  };

  const tabs = [...document.querySelectorAll('.tour-tab')];
  const tourImage = document.getElementById('tour-image');
  const tourEyebrow = document.getElementById('tour-eyebrow');
  const tourTitle = document.getElementById('tour-title');
  const tourText = document.getElementById('tour-text');
  const tourPanel = document.getElementById('tour-panel');

  const select = (key, focus = false) => {
    const entry = tour[key];
    if (!entry) return;
    for (const tab of tabs) {
      const active = tab.dataset.tour === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    if (tourImage) {
      tourImage.src = `assets/screens/${key}.jpg`;
      tourImage.alt = `Union ${entry.eyebrow} screen`;
    }
    if (tourEyebrow) tourEyebrow.textContent = entry.eyebrow;
    if (tourTitle) tourTitle.textContent = entry.title;
    if (tourText) tourText.textContent = entry.text;
    if (tourPanel) tourPanel.setAttribute('aria-labelledby', `tab-${key}`);
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.tour));
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      select(next.dataset.tour, true);
    });
  }

  // Preload the other screens after the page settles.
  addEventListener('load', () => {
    for (const key of Object.keys(tour)) {
      if (key === 'home') continue;
      const img = new Image();
      img.src = `assets/screens/${key}.jpg`;
    }
  });
})();
