const app = (() => {
  const utils = {
    qs: (selector, root = document) => root.querySelector(selector),
    qsa: (selector, root = document) => Array.from(root.querySelectorAll(selector)),
    on: (el, event, fn) => el && el.addEventListener(event, fn),
  };

  const initMenu = () => {
    const button = utils.qs('.nav-toggle');
    const nav = utils.qs('.nav-primary');
    utils.on(button, 'click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('nav-open');
    });
  };

  const initDarkMode = () => {
    const toggle = utils.qs('#themeToggle');
    const root = document.documentElement;
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      root.setAttribute('data-theme', 'dark');
    }
    utils.on(toggle, 'click', () => {
      const active = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', active ? 'light' : 'dark');
      localStorage.setItem('theme', active ? 'light' : 'dark');
      toggle.textContent = active ? 'Dark mode' : 'Light mode';
    });
  };

  const initSearch = () => {
    const input = utils.qs('#siteSearch');
    const cards = utils.qsa('[data-search]');
    if (!input || !cards.length) return;
    utils.on(input, 'input', () => {
      const query = input.value.trim().toLowerCase();
      cards.forEach(card => {
        const text = card.dataset.search.toLowerCase();
        card.style.display = text.includes(query) ? 'grid' : 'none';
      });
    });
  };

  const initScroll = () => {
    const progress = utils.qs('.reading-progress');
    if (!progress) return;
    const onScroll = () => {
      const scroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent = height > 0 ? Math.min(100, (scroll / height) * 100) : 0;
      progress.style.width = `${percent}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  const initShare = () => {
    const buttons = utils.qsa('[data-share]');
    buttons.forEach(button => {
      utils.on(button, 'click', async () => {
        const url = button.dataset.url || window.location.href;
        const title = document.title;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch (error) {
            console.warn(error);
          }
          return;
        }
        await navigator.clipboard.writeText(url);
        button.textContent = 'Link copied';
        setTimeout(() => (button.textContent = 'Share'), 1800);
      });
    });
  };

  const init = () => {
    initMenu();
    initDarkMode();
    initSearch();
    initScroll();
    initShare();
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', app.init);