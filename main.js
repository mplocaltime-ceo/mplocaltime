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

  const normalizeStory = (story, fallbackIndex = 0) => ({
    title: story.title || `Local update ${fallbackIndex + 1}`,
    excerpt: story.excerpt || story.content?.slice(0, 140) || 'A concise update from the newsroom.',
    category: story.category || 'News',
    author: story.author || 'Mpumalanga Local Time',
    date: story.submittedAt ? new Date(story.submittedAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'Today',
    readingTime: story.reading_time || 4,
    image: story.featured_image || '/logo.png',
    id: story.id || fallbackIndex + 1,
  });

  const initHeroSlider = async () => {
    const container = utils.qs('#heroSlides');
    const dots = utils.qs('#heroDots');
    if (!container) return;

    try {
      const latestRes = await fetch('/api/latest-stories?limit=4');
      const latestData = await latestRes.json();
      const stories = latestData.stories?.length ? latestData.stories : fallbackStories;
      const slides = stories.slice(0, 4).map((story, index) => normalizeStory(story, index));

      if (!slides.length) {
        container.innerHTML = '<div class="hero-slide"><div class="hero-slide-content"><p class="section-kicker">Latest news</p><h2>Local reporting continues to grow.</h2></div></div>';
        return;
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
  };

  const initLatestNews = async () => {
    const trending = utils.qs('#trendingStories');
    const latestGrid = utils.qs('#latestNewsGrid');
    if (!trending && !latestGrid) return;

    try {
      const featuredRes = await fetch('/api/featured-story');
      const featuredData = await featuredRes.json();
      const latestRes = await fetch(`/api/latest-stories${featuredData.story ? `?exclude=${featuredData.story.id}` : ''}&limit=6`);
      const latestData = await latestRes.json();
      const stories = latestData.stories?.length ? latestData.stories : fallbackStories;

      if (trending) {
        const topStories = stories.slice(0, 4);
        trending.innerHTML = topStories.length ? topStories.map(story => {
          const normalized = normalizeStory(story, topStories.indexOf(story));
          return `
            <article class="latest-card" data-search="${escapeHTML(normalized.title)} ${escapeHTML(normalized.category)}">
              <img src="${normalized.image}" alt="${escapeHTML(normalized.title)}" loading="lazy">
              <div class="latest-card-body">
                <span class="category-pill">${escapeHTML(normalized.category)}</span>
                <h3>${escapeHTML(normalized.title)}</h3>
                <p>${escapeHTML(normalized.excerpt)}</p>
              </div>
            </article>
          `;
        }).join('') : '<p>No trending stories available.</p>';
      }

      if (latestGrid) {
        const moreStories = stories.slice(0, 6);
        latestGrid.innerHTML = moreStories.length ? moreStories.map(story => {
          const normalized = normalizeStory(story, moreStories.indexOf(story));
          return `
            <article class="latest-card" data-search="${escapeHTML(normalized.title)} ${escapeHTML(normalized.category)}">
              <img src="${normalized.image}" alt="${escapeHTML(normalized.title)}" loading="lazy">
              <div class="latest-card-body">
                <span class="category-pill">${escapeHTML(normalized.category)}</span>
                <h3>${escapeHTML(normalized.title)}</h3>
                <p>${escapeHTML(normalized.excerpt)}</p>
                <div class="hero-slide-meta">
                  <span>By ${escapeHTML(normalized.author)}</span>
                  <span>•</span>
                  <span>${escapeHTML(normalized.date)}</span>
                </div>
              </div>
            </article>
          `;
        }).join('') : '<p>No latest stories available.</p>';
      }
    } catch (error) {
      console.error('Error loading latest news:', error);
      if (trending) {
        trending.innerHTML = fallbackStories.slice(0, 4).map((story, index) => {
          const normalized = normalizeStory(story, index);
          return `
            <article class="latest-card" data-search="${escapeHTML(normalized.title)} ${escapeHTML(normalized.category)}">
              <img src="${normalized.image}" alt="${escapeHTML(normalized.title)}" loading="lazy">
              <div class="latest-card-body">
                <span class="category-pill">${escapeHTML(normalized.category)}</span>
                <h3>${escapeHTML(normalized.title)}</h3>
                <p>${escapeHTML(normalized.excerpt)}</p>
              </div>
            </article>
          `;
        }).join('');
      }
      if (latestGrid) {
        latestGrid.innerHTML = fallbackStories.slice(0, 6).map((story, index) => {
          const normalized = normalizeStory(story, index);
          return `
            <article class="latest-card" data-search="${escapeHTML(normalized.title)} ${escapeHTML(normalized.category)}">
              <img src="${normalized.image}" alt="${escapeHTML(normalized.title)}" loading="lazy">
              <div class="latest-card-body">
                <span class="category-pill">${escapeHTML(normalized.category)}</span>
                <h3>${escapeHTML(normalized.title)}</h3>
                <p>${escapeHTML(normalized.excerpt)}</p>
                <div class="hero-slide-meta">
                  <span>By ${escapeHTML(normalized.author)}</span>
                  <span>•</span>
                  <span>${escapeHTML(normalized.date)}</span>
                </div>
              </div>
            </article>
          `;
        }).join('');
      }
    }
  };

  const initNewsletter = () => {
    const form = utils.qs('#newsletterForm');
    if (!form) return;
    utils.on(form, 'submit', (event) => {
      event.preventDefault();
      const input = utils.qs('#newsletterEmail', form);
      if (!input.value.trim()) return;
      const button = utils.qs('button', form);
      const original = button.textContent;
      button.textContent = 'Subscribed';
      input.value = '';
      setTimeout(() => (button.textContent = original), 1800);
    });
  };

  const init = () => {
    initMenu();
    initHeader();
    initDarkMode();
    initSearch();
    initScroll();
    initShare();
    initHeroSlider();
    initLatestNews();
    initNewsletter();
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', app.init);