const app = (() => {
  const utils = {
    qs: (selector, root = document) => root.querySelector(selector),
    qsa: (selector, root = document) => Array.from(root.querySelectorAll(selector)),
    on: (el, event, fn) => el && el.addEventListener(event, fn),
  };

  const escapeHTML = (text) => {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
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

  const initHeader = () => {
    const header = utils.qs('.site-header');
    const onScroll = () => {
      header?.classList.toggle('scrolled', window.scrollY > 16);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  const initDarkMode = () => {
    const toggle = utils.qs('#themeToggle');
    const root = document.documentElement;
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      root.setAttribute('data-theme', 'dark');
      if (toggle) toggle.textContent = '🌙';
    }
    utils.on(toggle, 'click', () => {
      const active = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', active ? 'light' : 'dark');
      localStorage.setItem('theme', active ? 'light' : 'dark');
      toggle.textContent = active ? '☀️' : '🌙';
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
    const backToTop = utils.qs('#backToTop');
    if (!progress) return;
    const onScroll = () => {
      const scroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent = height > 0 ? Math.min(100, (scroll / height) * 100) : 0;
      progress.style.width = `${percent}%`;
      if (backToTop) {
        backToTop.classList.toggle('visible', scroll > 600);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    utils.on(backToTop, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
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

  const fallbackStories = [
    {
      title: 'Mbombela clinics see faster access after mobile health rollout',
      excerpt: 'Residents in the Lowveld say the new medical outreach programme is shrinking delays and bringing specialist care closer to home.',
      category: 'Health',
      author: 'Nokuthula Mkhize',
      submittedAt: '2026-07-18T08:30:00Z',
      reading_time: 4,
      featured_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80',
    },
    {
      title: 'Local roads and transport links gain momentum ahead of the busy season',
      excerpt: 'Business owners and commuters say the latest upgrades are cutting travel time and improving access to key growth corridors.',
      category: 'Business',
      author: 'Sipho Dlamini',
      submittedAt: '2026-07-16T10:00:00Z',
      reading_time: 5,
      featured_image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80',
    },
    {
      title: 'School and youth programmes expand as community leaders back local learning',
      excerpt: 'New partnerships are helping young people stay engaged through mentorship, arts and practical learning opportunities.',
      category: 'Education',
      author: 'Ayanda Mbatha',
      submittedAt: '2026-07-15T14:00:00Z',
      reading_time: 3,
      featured_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
    },
  ];

  const pulseCategoryOrder = ['Business', 'Arts', 'Sports', 'Community'];

  const getPulseStories = (stories) => {
    const targetStories = stories.filter((story) => {
      const category = String(story.category || '').trim().toLowerCase();
      return pulseCategoryOrder.some((name) => name.toLowerCase() === category);
    });

    const orderedStories = pulseCategoryOrder.flatMap((category) => {
      const matches = targetStories.filter((story) => String(story.category || '').trim().toLowerCase() === category.toLowerCase());
      return matches.slice(0, 1);
    });

    const fallbackMatches = fallbackStories.filter((story) => {
      const category = String(story.category || '').trim().toLowerCase();
      return pulseCategoryOrder.some((name) => name.toLowerCase() === category);
    });

    const combined = [...orderedStories];
    fallbackMatches.forEach((story) => {
      const alreadyIncluded = combined.some((item) => item.title === story.title);
      if (combined.length < 4 && !alreadyIncluded) {
        combined.push(story);
      }
    });

    return combined.slice(0, 4).map((story, index) => normalizeStory(story, index));
  };

  const normalizeStory = (story, fallbackIndex = 0) => ({
    title: story.title || `Local update ${fallbackIndex + 1}`,
    excerpt: story.excerpt || story.content?.slice(0, 140) || 'A concise update from the newsroom.',
    category: story.category || 'News',
    author: story.author || 'Mpumalanga Local Time',
    date: story.submittedAt ? new Date(story.submittedAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'Today',
    readingTime: story.reading_time || 4,
    image: story.featured_image || '/logo.png',
    views: Number(story.views || 0),
    id: story.id || fallbackIndex + 1,
  });

  let heroStoryIds = [];

  const initHeroSlider = async () => {
    const container = utils.qs('#heroSlides');
    const dots = utils.qs('#heroDots');
    if (!container) return [];

    try {
      const latestRes = await fetch('/api/latest-stories?limit=4');
      const latestData = await latestRes.json();
      const stories = latestData.stories?.length ? latestData.stories : fallbackStories;
      const slides = stories.slice(0, 4).map((story, index) => normalizeStory(story, index));
      heroStoryIds = slides.map(slide => slide.id);

      if (!slides.length) {
        container.innerHTML = '<div class="hero-slide"><div class="hero-slide-content"><p class="section-kicker">Latest news</p><h2>Local reporting continues to grow.</h2></div></div>';
        return [];
      }

      let index = 0;
      const render = () => {
        const slide = slides[index];
        const total = slides.length;
        container.innerHTML = `
          <article class="hero-slide" style="background-image:url('${slide.image}')">
            <div class="hero-slide-content">
              <div class="hero-slide-top">
                <p class="section-kicker">Latest news</p>
                <span class="hero-slide-counter">${index + 1}/${total}</span>
              </div>
              <p class="hero-slide-category">${escapeHTML(slide.category)}</p>
              <h2>${escapeHTML(slide.title)}</h2>
              <p>${escapeHTML(slide.excerpt)}</p>
              <div class="hero-slide-meta">
                <span>By ${escapeHTML(slide.author)}</span>
                <span>•</span>
                <span>${escapeHTML(slide.date)}</span>
                <span>•</span>
                <span>${slide.readingTime} min read</span>
              </div>
            </div>
          </article>`;
        dots.innerHTML = slides.map((_, i) => `<button type="button" class="${i === index ? 'active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('');
      };

      const onNav = (direction) => {
        index = (index + direction + slides.length) % slides.length;
        render();
      };

      render();
      utils.qsa('.hero-nav').forEach(button => utils.on(button, 'click', () => onNav(Number(button.dataset.direction))));
      utils.qsa('.hero-dots button').forEach(button => utils.on(button, 'click', () => {
        index = Number(button.dataset.index);
        render();
      }));
      setInterval(() => onNav(1), 7000);
      return slides.map(slide => slide.id);
    } catch (error) {
      console.error('Error loading hero slider:', error);
      const slides = fallbackStories.slice(0, 4).map((story, index) => normalizeStory(story, index));
      container.innerHTML = `
        <article class="hero-slide" style="background-image:url('${slides[0].image}')">
          <div class="hero-slide-content">
            <div class="hero-slide-top">
              <p class="section-kicker">Latest news</p>
              <span class="hero-slide-counter">1/${slides.length}</span>
            </div>
            <p class="hero-slide-category">${escapeHTML(slides[0].category)}</p>
            <h2>${escapeHTML(slides[0].title)}</h2>
            <p>${escapeHTML(slides[0].excerpt)}</p>
          </div>
        </article>`;
    }
    return [];
  };

  const initLatestNews = async (excludedIds = []) => {
    const latestGrid = utils.qs('#latestNewsGrid');
    if (!latestGrid) return;

    try {
      const latestRes = await fetch('/api/latest-stories');
      const latestData = await latestRes.json();
      const stories = latestData.stories?.length ? latestData.stories : fallbackStories;
      const pulseStories = getPulseStories(stories.filter(story => !(excludedIds.includes(story.id) || heroStoryIds.includes(story.id))));
      const finalStories = pulseStories.length
        ? pulseStories
        : getPulseStories(stories.slice(0, 4));

      latestGrid.innerHTML = finalStories.map((story) => `
        <article class="latest-card pulse-card" data-search="${escapeHTML(story.title)} ${escapeHTML(story.category)}">
          <img src="${story.image}" alt="${escapeHTML(story.title)}" loading="lazy">
          <div class="latest-card-body">
            <span class="category-pill">${escapeHTML(story.category)}</span>
            <h3>${escapeHTML(story.title)}</h3>
            <p>${escapeHTML(story.excerpt)}</p>
            <div class="story-meta">
              <span>By ${escapeHTML(story.author)}</span>
              <span>•</span>
              <span>${escapeHTML(story.date)}</span>
            </div>
            <div class="pulse-footer">
              <div class="story-stats">
                <span>${story.readingTime} min read</span>
                <span>•</span>
                <span>${story.views || 0} views</span>
              </div>
              <div class="pulse-actions">
                <button class="icon-button" type="button" data-share data-url="${window.location.href}">Share</button>
                <a class="btn primary small" href="/news.html">Read more</a>
              </div>
            </div>
          </div>
        </article>
      `).join('');
      initShare();
    } catch (error) {
      console.error('Error loading latest news:', error);
      latestGrid.innerHTML = fallbackStories.slice(0, 6).map((story, index) => {
        const normalized = normalizeStory(story, index);
        return `
          <article class="latest-card pulse-card" data-search="${escapeHTML(normalized.title)} ${escapeHTML(normalized.category)}">
            <img src="${normalized.image}" alt="${escapeHTML(normalized.title)}" loading="lazy">
            <div class="latest-card-body">
              <span class="category-pill">${escapeHTML(normalized.category)}</span>
              <h3>${escapeHTML(normalized.title)}</h3>
              <p>${escapeHTML(normalized.excerpt)}</p>
              <div class="story-meta">
                <span>By ${escapeHTML(normalized.author)}</span>
                <span>•</span>
                <span>${escapeHTML(normalized.date)}</span>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  };

  const init = async () => {
    initMenu();
    initHeader();
    initDarkMode();
    initSearch();
    initScroll();
    initShare();
    const heroIds = await initHeroSlider();
    await initLatestNews(heroIds || []);
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', app.init);