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

  const initLatestNews = async () => {
    const container = utils.qs('#latestNewsContainer');
    if (!container) return;

    try {
      // Fetch featured story
      const featuredRes = await fetch('/api/featured-story');
      const featuredData = await featuredRes.json();
      
      // Fetch latest stories
      const latestRes = await fetch(`/api/latest-stories${featuredData.story ? `?exclude=${featuredData.story.id}` : ''}`);
      const latestData = await latestRes.json();

      // Render featured story
      const featuredHTML = featuredData.story ? `
        <article class="featured-story" onclick="window.location.href='/news.html#story-${featuredData.story.id}'">
          <div class="featured-story-image">
            <img 
              src="${featuredData.story.featured_image || '/logo.png'}" 
              alt="${escapeHTML(featuredData.story.title)}"
              loading="lazy"
            />
            <span class="featured-story-badge">${escapeHTML(featuredData.story.category || 'News')}</span>
          </div>
          <div class="featured-story-content">
            <h3 class="featured-story-title">${escapeHTML(featuredData.story.title)}</h3>
            <p class="featured-story-excerpt">${escapeHTML(featuredData.story.excerpt || featuredData.story.content.substring(0, 150))}</p>
            <div class="featured-story-meta">
              <span class="meta-item">${new Date(featuredData.story.submittedAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              <span class="meta-item">by <strong>${escapeHTML(featuredData.story.author || 'Anonymous')}</strong></span>
              <span class="meta-item"><strong>${featuredData.story.reading_time || 5}</strong> min read</span>
              <span class="meta-item"><strong>${featuredData.story.views || 0}</strong> views</span>
              <span class="meta-item"><strong>${featuredData.story.comments || 0}</strong> comments</span>
            </div>
          </div>
        </article>
      ` : '<p>No featured story available.</p>';

      // Render latest stories
      const storiesHTML = latestData.stories && latestData.stories.length > 0 ? `
        <div class="latest-stories-list">
          ${latestData.stories.map(story => `
            <article class="story-item" onclick="window.location.href='/news.html#story-${story.id}'">
              <div class="story-item-image">
                <img 
                  src="${story.featured_image || '/logo.png'}" 
                  alt="${escapeHTML(story.title)}"
                  loading="lazy"
                />
              </div>
              <div class="story-item-content">
                <h4 class="story-item-title">${escapeHTML(story.title)}</h4>
                <div class="story-item-meta">
                  <span class="story-category">${escapeHTML(story.category || 'News')}</span>
                  <span>${new Date(story.submittedAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}</span>
                  <span>${story.reading_time || 5} min</span>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      ` : '<p>No latest stories available.</p>';

      container.innerHTML = `<div style="grid-column: 1;">${featuredHTML}</div><div style="grid-column: 2;">${storiesHTML}</div>`;
      container.style.display = 'grid';
      container.style.gridTemplateColumns = '1.6fr 1fr';
      container.style.gap = '32px';
    } catch (error) {
      console.error('Error loading latest news:', error);
      container.innerHTML = '<p>Unable to load latest news. Please try again later.</p>';
    }
  };

  const escapeHTML = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const init = () => {
    initMenu();
    initDarkMode();
    initSearch();
    initScroll();
    initShare();
    initLatestNews();
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', app.init);