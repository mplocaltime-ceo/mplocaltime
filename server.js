require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { init } = require('./db');

const DEFAULT_ADMIN = {
  username: 'admin',
  passwordEnv: process.env.INITIAL_PASSWORD || 'changeme',
  bio: 'Publisher and managing editor of Mpumalanga Local Time.',
  avatar: '/logo.png',
  role: 'admin'
};
const DEFAULT_USER = {
  username: 'reporter',
  passwordEnv: process.env.INITIAL_USER_PASSWORD || 'contributor',
  bio: 'Contributor covering local stories across Mpumalanga.',
  avatar: '/logo.png',
  role: 'user'
};

async function initializeDatabase() {
  const db = await init();
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        bio TEXT,
        avatar TEXT,
        role TEXT NOT NULL DEFAULT 'user'
      );
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT,
        content TEXT,
        author_id INTEGER,
        submittedAt TEXT,
        views INTEGER DEFAULT 0,
        featured INTEGER DEFAULT 0,
        featured_image TEXT,
        excerpt TEXT,
        reading_time INTEGER DEFAULT 5,
        is_breaking INTEGER DEFAULT 0,
        FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        author TEXT,
        text TEXT,
        at TEXT,
        FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE
      );
    `);

    const userColumns = await db.all(`PRAGMA table_info(users)`);
    const columnNames = userColumns.map((col) => col.name);
    if (!columnNames.includes('bio')) {
      await db.run(`ALTER TABLE users ADD COLUMN bio TEXT`);
    }
    if (!columnNames.includes('avatar')) {
      await db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`);
    }
    if (!columnNames.includes('role')) {
      await db.run(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
      await db.run(`UPDATE users SET role = 'user' WHERE role IS NULL`);
    } else {
      await db.run(`UPDATE users SET role = 'user' WHERE role IS NULL`);
    }

    const storyColumns = await db.all('PRAGMA table_info(stories)');
    if (!storyColumns.some((column) => column.name === 'is_breaking')) {
      await db.run('ALTER TABLE stories ADD COLUMN is_breaking INTEGER DEFAULT 0');
    }

    const existingAdmin = await db.get(`SELECT id FROM users WHERE username = ?`, [DEFAULT_ADMIN.username]);
    if (!existingAdmin) {
      const hash = await bcrypt.hash(DEFAULT_ADMIN.passwordEnv, 10);
      await db.run(`INSERT INTO users (username, password, bio, avatar, role) VALUES (?, ?, ?, ?, ?)`, [DEFAULT_ADMIN.username, hash, DEFAULT_ADMIN.bio, DEFAULT_ADMIN.avatar, DEFAULT_ADMIN.role]);
    }

    const existingReporter = await db.get(`SELECT id FROM users WHERE username = ?`, [DEFAULT_USER.username]);
    if (!existingReporter) {
      const hash = await bcrypt.hash(DEFAULT_USER.passwordEnv, 10);
      await db.run(`INSERT INTO users (username, password, bio, avatar, role) VALUES (?, ?, ?, ?, ?)`, [DEFAULT_USER.username, hash, DEFAULT_USER.bio, DEFAULT_USER.avatar, DEFAULT_USER.role]);
    }

    const existingStory = await db.get(`SELECT id FROM stories LIMIT 1`);
    if (!existingStory) {
      const now = new Date().toISOString();
      const sampleStories = [
        {
          title: 'Mbombela clinics see faster access after mobile health rollout',
          category: 'Health',
          content: 'Residents in the Lowveld say the latest medical outreach programme is shrinking delays and bringing specialist care closer to home.',
          excerpt: 'Residents in the Lowveld say the new medical outreach programme is shrinking delays and bringing specialist care closer to home.',
          featured_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80',
          reading_time: 4,
          is_breaking: 1,
        },
        {
          title: 'Local roads and transport links gain momentum ahead of the busy season',
          category: 'Business',
          content: 'Business owners and commuters say the latest upgrades are cutting travel time and improving access to key growth corridors.',
          excerpt: 'Business owners and commuters say the latest upgrades are cutting travel time and improving access to key growth corridors.',
          featured_image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80',
          reading_time: 5,
          is_breaking: 1,
        },
        {
          title: 'School and youth programmes expand as community leaders back local learning',
          category: 'Education',
          content: 'New partnerships are helping young people stay engaged through mentorship, arts and practical learning opportunities.',
          excerpt: 'New partnerships are helping young people stay engaged through mentorship, arts and practical learning opportunities.',
          featured_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
          reading_time: 3,
          is_breaking: 0,
        }
      ];

      const user = await db.get(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
      for (const story of sampleStories) {
        await db.run(`
          INSERT INTO stories (title, category, content, author_id, submittedAt, views, featured, featured_image, excerpt, reading_time, is_breaking)
          VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        `, [story.title, story.category, story.content, user?.id || null, now, story.featured_image, story.excerpt, story.reading_time, story.is_breaking || 0]);
      }
    }
  } finally {
    await db.close();
  }
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(express.static(path.join(__dirname, '/public')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// For any non-API route, check if HTML file exists
app.get('/:page', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const file = path.join(__dirname, req.path + '.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  next();
});

async function withDB(fn) {
  const db = await init();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  return withDB(async (db) => {
    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const role = user.role || 'user';
    const token = jwt.sign({ id: user.id, username: user.username, role }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, role });
  });
});

// registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  return withDB(async (db) => {
    const exists = await db.get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (exists) return res.status(409).json({ error: 'username taken' });
    const hash = await bcrypt.hash(password, 10);
    const r = await db.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, [username, hash, 'user']);
    const user = await db.get(`SELECT id, username, role FROM users WHERE id = ?`, [r.lastID]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, role: user.role || 'user' });
  });
});

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'missing token' });
  try {
    const data = jwt.verify(m[1], SECRET);
    req.user = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.post('/api/stories', authMiddleware, async (req, res) => {
  const { title, category, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  return withDB(async (db) => {
    const submittedAt = new Date().toISOString();
    const r = await db.run(`INSERT INTO stories (title,category,content,author_id,submittedAt,views) VALUES (?,?,?,?,?,0)`, [title, category, content, req.user.id, submittedAt]);
    const story = await db.get(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ?`, [r.lastID]);
    res.json({ story });
  });
});

app.get('/api/stories', authMiddleware, async (req, res) => {
  const author = req.query.author;
  return withDB(async (db) => {
    if (author) {
      const rows = await db.all(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE u.username = ? ORDER BY s.submittedAt DESC`, [author]);
      // attach comments count
      const out = await Promise.all(rows.map(async (r) => {
        const c = await db.get(`SELECT COUNT(*) as cnt FROM comments WHERE story_id = ?`, [r.id]);
        r.comments = Number(c.cnt || 0);
        return r;
      }));
      return res.json({ stories: out });
    }
    const rows = await db.all(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id ORDER BY s.submittedAt DESC`);
    res.json({ stories: rows });
  });
});

app.post('/api/stories/:id/view', async (req, res) => {
  const id = req.params.id;
  return withDB(async (db) => {
    await db.run(`UPDATE stories SET views = COALESCE(views,0) + 1 WHERE id = ?`, [id]);
    const s = await db.get(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ?`, [id]);
    res.json({ story: s });
  });
});

app.post('/api/stories/:id/comments', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'comment text required' });
  return withDB(async (db) => {
    const at = new Date().toISOString();
    await db.run(`INSERT INTO comments (story_id, author, text, at) VALUES (?,?,?,?)`, [id, req.user.username, text, at]);
    const comments = await db.all(`SELECT author, text, at FROM comments WHERE story_id = ? ORDER BY id DESC`, [id]);
    res.json({ comments });
  });
});

app.get('/api/stories/:id', async (req, res) => {
  const id = req.params.id;
  return withDB(async (db) => {
    const s = await db.get(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ?`, [id]);
    const comments = await db.all(`SELECT author, text, at FROM comments WHERE story_id = ? ORDER BY id DESC`, [id]);
    res.json({ story: s, comments });
  });
});

// Serve a rendered article page for story details
app.get('/story/:id', async (req, res) => {
  const id = req.params.id;
  return withDB(async (db) => {
    await db.run(`UPDATE stories SET views = COALESCE(views,0) + 1 WHERE id = ?`, [id]);
    const s = await db.get(`SELECT s.*, u.username as author, u.bio as author_bio, u.avatar as author_avatar FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ?`, [id]);
    if (!s) return res.status(404).send('Article not found');
    const comments = await db.all(`SELECT author, text, at FROM comments WHERE story_id = ? ORDER BY id DESC`, [id]);
    let related = await db.all(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id != ? AND s.category = ? ORDER BY s.submittedAt DESC LIMIT 3`, [id, s.category || '']);
    const trending = await db.all(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id != ? ORDER BY s.views DESC, s.submittedAt DESC LIMIT 3`, [id]);
    if (!related.length) {
      related = await db.all(`SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id != ? ORDER BY s.submittedAt DESC LIMIT 3`, [id]);
    }

    const title = s.title || 'Article';
    const excerpt = s.excerpt || (s.content ? s.content.slice(0, 160) : '');
    const image = s.featured_image || '/logo.png';
    const publishedAt = s.submittedAt ? new Date(s.submittedAt).toISOString() : '';
    const date = s.submittedAt ? new Date(s.submittedAt).toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' }) : '';
    const updatingAt = publishedAt;
    const shareUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const authorAvatar = s.author_avatar || '/logo.png';
    const authorDescription = s.author_bio || `Local ${escapeHtml(s.category || 'news').toLowerCase()} reporter bringing stories from around Mpumalanga to readers every day.`;
    const contentHtml = formatArticleContent(s.content || '');
    const commentsCount = comments.length;
    const commentsHtml = commentsCount
      ? comments.map((comment) => `
          <div class="comment">
            <strong>${escapeHtml(comment.author || 'Guest')}</strong>
            <time datetime="${escapeAttr(comment.at || '')}">${escapeHtml(comment.at ? new Date(comment.at).toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' }) : '')}</time>
            <p>${escapeHtml(comment.text || '')}</p>
          </div>
        `).join('')
      : '<p class="comment-empty">No comments yet. Be the first to respond.</p>';

    const relatedHtml = related.map((item) => `
      <div class="single-related-posts">
        <div class="related-posts-thumbnail">
          <a href="/story/${item.id}">
            <img src="${escapeHtml(item.featured_image || '/logo.png')}" alt="${escapeHtml(item.title)}" />
          </a>
        </div>
        <div class="cm-post-content">
          <h3 class="cm-entry-title"><a href="/story/${item.id}">${escapeHtml(item.title)}</a></h3>
          <div class="cm-below-entry-meta cm-separator-default">
            <span class="cm-post-date"><time datetime="${escapeAttr(item.submittedAt || '')}">${escapeHtml(item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-ZA', { month:'long', day:'numeric', year:'numeric' }) : '')}</time></span>
            <span class="cm-author cm-vcard"><a href="/">${escapeHtml(item.author || 'Mpumalanga Local Time')}</a></span>
          </div>
        </div>
      </div>
    `).join('');

    const html = `<!doctype html>
<html dir="ltr" lang="en-ZA" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - Mpumalanga Local Time</title>
  <meta name="description" content="${escapeHtml(excerpt)}" />
  <meta name="robots" content="max-image-preview:large" />
  <meta name="author" content="${escapeHtml(s.author || 'Mpumalanga Local Time')}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="Mpumalanga Local Time - Skhatsini eMpumalanga" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} - Mpumalanga Local Time" />
  <meta property="og:description" content="${escapeHtml(excerpt)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(req.protocol + '://' + req.get('host') + req.originalUrl)}" />
  <meta property="article:published_time" content="${publishedAt}" />
  <meta property="article:modified_time" content="${updatingAt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(excerpt)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    :root { color-scheme: light; font-family: 'Open Sans', Arial, sans-serif; }
    body { margin:0; color:#222; background:#f4f4f4; }
    .cm-header-builder { background:#fff; border-bottom:1px solid #e8e8e8; }
    .cm-row, .cm-container, .cm-main-row, .cm-footer-main-row { width:100%; max-width:1200px; margin:0 auto; box-sizing:border-box; }
    .cm-container { padding:0 18px; }
    .cm-top-row, .cm-bottom-row, .cm-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
    .date-in-header { font-size:.9rem; color:#555; }
    .breaking-news { flex:1; font-size:.95rem; color:#111; }
    .breaking-news ul { list-style:none; padding:0; margin:0; display:flex; gap:.75rem; flex-wrap:wrap; }
    .breaking-news a { color:#c00; text-decoration:none; }
    #cm-primary-nav ul { list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:1rem; }
    #cm-primary-nav ul li a { color:#111; text-decoration:none; font-weight:600; }
    .cm-site-branding { display:flex; gap:.75rem; align-items:center; }
    .cm-site-branding img { height:52px; width:auto; display:block; }
    .cm-site-title a, .cm-site-branding a { color:#111; text-decoration:none; }
    .cm-content { padding:30px 0; }
    .cm-primary { width:100%; }
    .cm-posts { display:grid; gap:24px; }
    .article { background:#fff; padding:28px; box-shadow:0 14px 36px rgba(0,0,0,0.08); border-radius:12px; }
    .article-featured { width:100%; min-height:420px; background-size:cover; background-position:center; border-radius:12px; margin-bottom:24px; }
    .article-title { font-size:clamp(2.2rem, 2.3vw, 3rem); margin:0 0 14px; line-height:1.05; }
    .cm-below-entry-meta, .article-meta { display:flex; flex-wrap:wrap; gap:.75rem; color:#555; font-size:.95rem; margin-bottom:22px; }
    .article-content { line-height:1.84; color:#333; }
    .article-content p { margin:1.6em 0; font-size:1.07rem; }
    .article-content img { max-width:100%; height:auto; border-radius:12px; margin:1.5em 0; }
    .article-content a { color:#c00; text-decoration:underline; }
    .article-author-box { display:flex; gap:18px; align-items:flex-start; background:#faf9f7; padding:20px; border-radius:16px; margin:28px 0; }
    .author-avatar { width:72px; height:72px; border-radius:50%; overflow:hidden; flex-shrink:0; border:1px solid #eee; }
    .author-avatar img { width:100%; height:100%; object-fit:cover; }
    .author-meta { display:grid; gap:6px; }
    .author-byline { margin:0; font-size:1rem; color:#111; }
    .author-description { margin:0; color:#555; line-height:1.6; }
    .article-share { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:16px 0 32px; }
    .share-button { display:inline-flex; align-items:center; gap:8px; border:1px solid #ddd; background:#fff; color:#111; border-radius:999px; padding:12px 18px; font-size:.95rem; transition:all .2s ease; }
    .share-button:hover { border-color:#c00; color:#c00; }
    .article-comments { margin-top:46px; }
    .article-comments h2 { margin-bottom:18px; font-size:1.45rem; }
    .comment-auth-panel { margin-bottom:18px; color:#555; }
    .comment-login-form { display:grid; gap:12px; margin-top:14px; }
    .comment-login-form input { width:100%; padding:14px 16px; border:1px solid #ddd; border-radius:14px; background:#fff; color:#111; }
    .comment-login-form button { border:none; border-radius:999px; padding:14px 22px; background:#c00; color:#fff; font-size:1rem; }
    .comment-form { display:grid; gap:14px; margin-top:20px; }
    .comment-form textarea { width:100%; min-height:140px; border:1px solid #ddd; border-radius:14px; padding:16px; font:inherit; resize:vertical; background:#fbfbfb; color:#111; }
    .comment-form-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px; align-items:center; margin-top:6px; }
    .comment-form button { border:none; border-radius:999px; padding:14px 22px; background:#c00; color:#fff; font-size:1rem; transition:transform .2s ease; }
    .comment-form button:hover { transform:translateY(-1px); }
    .comment-form-message { color:#555; font-size:.95rem; }
    .comment-empty { color:#666; margin:0; }
    .comment-list { display:grid; gap:18px; margin-top:24px; }
    .comment { border-top:1px solid #e8e8e8; padding:18px 0; }
    .comment strong { display:block; color:#111; margin-bottom:6px; }
    .comment time { display:block; color:#777; font-size:.92rem; margin-bottom:12px; }
    .cm-secondary { display:grid; gap:20px; }
    .widget { background:#fff; padding:22px; border-radius:18px; box-shadow:0 10px 24px rgba(0,0,0,0.04); }
    .widget h4 { margin:0 0 14px; font-size:1.05rem; color:#111; }
    .widget .widget-item { display:flex; gap:12px; align-items:flex-start; margin-bottom:16px; }
    .widget .widget-item:last-child { margin-bottom:0; }
    .widget .widget-item img { width:72px; height:56px; border-radius:12px; object-fit:cover; }
    .widget .widget-item-content { display:grid; gap:6px; }
    .widget .widget-item-content a { color:#111; font-weight:600; }
    .widget .widget-item-content time { font-size:.85rem; color:#666; }
    .newsletter-form { display:grid; gap:12px; margin-top:12px; }
    .newsletter-form input { width:100%; min-height:48px; border:1px solid #ddd; border-radius:14px; padding:12px 14px; background:#fff; color:#111; }
    .newsletter-form button { border:none; border-radius:999px; padding:14px 18px; background:#c00; color:#fff; font-size:1rem; cursor:pointer; }
    .article-related { margin-top:0; }
    .related-posts-wrapper { display:grid; gap:18px; }
    .single-related-posts { display:flex; gap:16px; align-items:flex-start; background:#fafafa; padding:16px; border-radius:12px; }
    .related-posts-thumbnail img { width:140px; height:90px; object-fit:cover; border-radius:8px; }
    .related-posts-thumbnail a { display:block; }
    .cm-entry-title { font-size:1.05rem; margin:0 0 10px; line-height:1.3; }
    .cm-entry-title a { color:#111; text-decoration:none; }
    .cm-footer { background:#111; color:#ddd; padding:32px 0; }
    .cm-footer a { color:#fff; text-decoration:none; }
    .cm-footer-cols { display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
    .cm-footer-menu { list-style:none; padding:0; margin:0; }
    .cm-footer-menu li { margin-bottom:.75rem; }
    .cm-footer-bottom-row { text-align:center; margin-top:28px; color:#999; font-size:.9rem; }
    @media (min-width: 900px) { .cm-main-row { display:flex; align-items:center; justify-content:space-between; } .cm-site-branding { gap:1rem; } .cm-primary { width:100%; } .cm-posts { grid-template-columns: 1fr 320px; } }
  </style>
  <script type="application/ld+json">{
    "@context":"https://schema.org",
    "@type":"BlogPosting",
    "headline":"${escapeHtml(title)}",
    "description":"${escapeHtml(excerpt)}",
    "image":"${escapeHtml(image)}",
    "author":{"@type":"Person","name":"${escapeHtml(s.author || 'Mpumalanga Local Time')}"},
    "publisher":{"@type":"Organization","name":"Mpumalanga Local Time","logo":{"@type":"ImageObject","url":"https://mplocaltime.co.za/logo.png"}},
    "datePublished":"${publishedAt}",
    "dateModified":"${updatingAt}",
    "mainEntityOfPage":{"@type":"WebPage","@id":"${escapeHtml(req.protocol + '://' + req.get('host') + req.originalUrl)}"}
  }</script>
</head>
<body class="wp-singular post-template-default single single-post postid-${s.id} single-format-standard">
  <div id="page" class="hfeed site">
    <a class="skip-link screen-reader-text" href="#main">Skip to content</a>
    <header id="cm-masthead" class="cm-header-builder cm-layout-1-style-1 cm-full-width">
      <div class="cm-row cm-desktop-row cm-main-header">
        <div class="cm-header-top-row">
          <div class="cm-container">
            <div class="cm-top-row">
              <div class="cm-header-left-col"><div class="date-in-header">${escapeHtml(new Date().toLocaleDateString('en-ZA', { weekday: 'long', year:'numeric', month:'long', day:'numeric' }))}</div></div>
              <div class="cm-header-right-col"><div class="breaking-news"><strong>Latest:</strong><ul class="newsticker">${(related.length ? related.slice(0,3) : []).map((item) => `<li><a href="/story/${item.id}">${escapeHtml(item.title)}</a></li>`).join('')}</ul></div></div>
            </div>
          </div>
        </div>
        <div class="cm-header-main-row">
          <div class="cm-container">
            <div class="cm-main-row">
              <div class="cm-header-left-col">
                <div class="cm-site-branding"><a href="/" class="custom-logo-link"><img src="/logo.png" alt="Mpumalanga Local Time" decoding="async" width="170" /></a></div>
              </div>
              <div class="cm-header-center-col"></div>
              <div class="cm-header-right-col"></div>
            </div>
          </div>
        </div>
        <div class="cm-header-bottom-row">
          <div class="cm-container"><nav id="cm-primary-nav" class="cm-primary-nav"><ul id="cm-primary-menu"><li><a href="/">Home</a></li><li><a href="/news.html">News</a></li><li><a href="/business.html">Business</a></li><li><a href="/arts.html">Arts</a></li><li><a href="/sports.html">Sports</a></li><li><a href="/community.html">Community</a></li></ul></nav></div>
        </div>
      </div>
    </header>
    <div id="cm-content" class="cm-content">
      <div class="cm-container">
        <div class="cm-row">
          <div id="cm-primary" class="cm-primary">
            <div class="cm-posts clearfix">
              <article id="post-${s.id}" class="post-${s.id} post type-post status-publish format-standard has-post-thumbnail hentry category-${escapeHtml((s.category||'news').toLowerCase())}">
                <div class="cm-post-content">
                  <div class="cm-featured-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="width:100%;height:auto;border-radius:12px;" /></div>
                  <header class="cm-entry-header"><h1 class="cm-entry-title">${escapeHtml(title)}</h1></header>
                  <div class="cm-below-entry-meta cm-separator-default">
                    <span class="cm-post-date"><time class="entry-date published updated" datetime="${publishedAt}">${escapeHtml(date)}</time></span>
                    <span class="cm-author cm-vcard"><a class="url fn n" href="/">${escapeHtml(s.author || 'admin')}</a></span>
                    <span class="cm-post-views">${s.views || 0} Views</span>
                  </div>
                  <div class="article-author-box">
                    <div class="author-avatar"><img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(s.author || 'Author')}" /></div>
                    <div class="author-meta">
                      <p class="author-byline">By <strong>${escapeHtml(s.author || 'Mpumalanga Local Time')}</strong></p>
                      <p class="author-description">${authorDescription}</p>
                    </div>
                  </div>
                  <div class="article-share">
                    <button type="button" class="share-button" data-article-share="copy" data-url="${escapeHtml(shareUrl)}">Copy link</button>
                    <button type="button" class="share-button" data-article-share="twitter" data-url="${escapeHtml(shareUrl)}" data-text="${escapeHtml(title)}">Tweet</button>
                    <button type="button" class="share-button" data-article-share="facebook" data-url="${escapeHtml(shareUrl)}">Facebook</button>
                  </div>
                  <div class="cm-entry-summary article-content">${contentHtml}</div>
                </div>
              </article>
              <div class="article-comments">
                <h2>${commentsCount} Comment${commentsCount === 1 ? '' : 's'}</h2>
                <div id="commentAuthPanel" class="comment-auth-panel">
                  <p id="commentAuthMessage">To post a comment, sign in with your contributor account or use the login page.</p>
                  <form id="commentLoginForm" class="comment-login-form" action="#" method="post">
                    <input id="commentLoginUsername" name="username" type="text" placeholder="Username" required />
                    <input id="commentLoginPassword" name="password" type="password" placeholder="Password" required />
                    <div class="comment-form-actions">
                      <span class="comment-form-message" id="commentLoginMessage"></span>
                      <button type="submit">Login</button>
                    </div>
                  </form>
                </div>
                <form id="commentForm" class="comment-form" action="#" method="post">
                  <textarea id="commentText" name="text" placeholder="Write your comment..." required></textarea>
                  <div class="comment-form-actions">
                    <span class="comment-form-message" id="commentFormMessage"></span>
                    <button type="submit">Post comment</button>
                  </div>
                </form>
                <div id="commentsList" class="comment-list">${commentsHtml}</div>
              </div>
              <aside id="cm-secondary" class="cm-secondary">
                <div class="article-related widget">
                  <h4>You May Also Like</h4>
                  <div class="related-posts-wrapper">${relatedHtml}</div>
                </div>
                <div class="widget">
                  <h4>Trending stories</h4>
                  ${trending.map((item) => `
                    <div class="widget-item">
                      <img src="${escapeHtml(item.featured_image || '/logo.png')}" alt="${escapeHtml(item.title)}" />
                      <div class="widget-item-content">
                        <a href="/story/${item.id}">${escapeHtml(item.title)}</a>
                        <time datetime="${escapeAttr(item.submittedAt || '')}">${escapeHtml(item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-ZA', { month:'short', day:'numeric' }) : '')}</time>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <div class="widget">
                  <h4>Newsletter</h4>
                  <p>Subscribe to our newsletter for the latest Mpumalanga stories and updates.</p>
                  <form class="newsletter-form" action="#" method="post" onsubmit="event.preventDefault(); alert('Newsletter signup is coming soon.');">
                    <input type="email" placeholder="Your email address" required />
                    <button type="submit">Subscribe</button>
                  </form>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
    <footer id="cm-footer" class="cm-footer cm-footer-builder">
      <div class="cm-row cm-footer-desktop-row">
        <div class="cm-footer-main-row"><div class="cm-container"><div class="cm-main-row"><div class="cm-footer-col cm-footer-main-1-col"><nav id="cm-footer-nav" class="cm-footer-nav"><ul id="cm-footer-menu" class="cm-footer-menu"><li><a href="/">Home</a></li><li><a href="/about.html">About Us</a></li><li><a href="/privacy-policy.html">Privacy Policy</a></li><li><a href="/terms-and-conditions.html">Terms & Conditions</a></li><li><a href="/contact.html">Contact</a></li></ul></nav></div></div></div></div>
      <div class="cm-footer-bottom-row"><div class="cm-container"><div class="cm-bottom-row"><div class="cm-footer-col cm-footer-bottom-1-col"><div class="cm-copyright copyright"><p style="text-align:center;color:#bbb;">Copyright © ${new Date().getFullYear()} Mpumalanga Local Time. Powered by Creative Space</p></div></div></div></div></div>
    </footer>
  </div>
  <script>
    (function() {
      const storyId = ${JSON.stringify(id)};
      const shareUrl = ${JSON.stringify(shareUrl)};
      const shareText = ${JSON.stringify(title)};
      const token = localStorage.getItem('token');
      const commentForm = document.getElementById('commentForm');
      const commentText = document.getElementById('commentText');
      const commentMessage = document.getElementById('commentFormMessage');
      const commentLoginForm = document.getElementById('commentLoginForm');
      const commentLoginMessage = document.getElementById('commentLoginMessage');
      const commentAuthPanel = document.getElementById('commentAuthPanel');
      const commentAuthMessage = document.getElementById('commentAuthMessage');
      const commentsList = document.getElementById('commentsList');
      const shareButtons = document.querySelectorAll('[data-article-share]');

      const renderComment = (comment) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'comment';
        const author = document.createElement('strong');
        author.textContent = comment.author || 'Guest';
        const time = document.createElement('time');
        time.dateTime = comment.at || '';
        time.textContent = comment.at ? new Date(comment.at).toLocaleDateString('en-ZA', { dateStyle:'long', timeStyle:'short'}) : '';
        const text = document.createElement('p');
        text.textContent = comment.text || '';
        wrapper.appendChild(author);
        wrapper.appendChild(time);
        wrapper.appendChild(text);
        return wrapper;
      };

      const updateComments = (items) => {
        if (!commentsList) return;
        commentsList.innerHTML = '';
        if (!items || !items.length) {
          const empty = document.createElement('p');
          empty.className = 'comment-empty';
          empty.textContent = 'No comments yet. Be the first to respond.';
          commentsList.appendChild(empty);
          return;
        }
        items.forEach((comment) => commentsList.appendChild(renderComment(comment)));
      };

      const setAuthView = () => {
        if (token) {
          if (commentAuthPanel) commentAuthPanel.style.display = 'none';
          if (commentForm) commentForm.style.display = 'grid';
          if (commentAuthMessage) commentAuthMessage.textContent = 'Leave a comment with your contributor account.';
          return;
        }
        if (commentAuthPanel) commentAuthPanel.style.display = 'block';
        if (commentForm) commentForm.style.display = 'none';
      };

      const handleShare = (mode, url, text) => {
        if (mode === 'copy') {
          navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard.')).catch(() => alert('Unable to copy link.'));
          return;
        }
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text || '');
        let shareLink = '';
        if (mode === 'twitter') {
          shareLink = 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedText;
        } else if (mode === 'facebook') {
          shareLink = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
        }
        if (shareLink) {
          window.open(shareLink, '_blank', 'noopener');
        }
      };

      if (shareButtons.length) {
        shareButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const mode = button.dataset.articleShare;
            const url = button.dataset.url || shareUrl;
            const text = button.dataset.text || shareText;
            handleShare(mode, url, text);
          });
        });
      }

      if (commentLoginForm) {
        commentLoginForm.addEventListener('submit', async function(event) {
          event.preventDefault();
          const username = document.getElementById('commentLoginUsername')?.value.trim();
          const password = document.getElementById('commentLoginPassword')?.value.trim();
          if (!username || !password) {
            if (commentLoginMessage) commentLoginMessage.textContent = 'Enter both username and password.';
            return;
          }
          if (commentLoginMessage) commentLoginMessage.textContent = 'Signing in...';
          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Login failed.');
            localStorage.setItem('token', result.token);
            localStorage.setItem('currentUser', result.username);
            if (commentLoginMessage) commentLoginMessage.textContent = 'Logged in successfully.';
            setTimeout(setAuthView, 300);
          } catch (err) {
            if (commentLoginMessage) commentLoginMessage.textContent = err.message;
          }
        });
      }

      if (commentForm) {
        commentForm.addEventListener('submit', async function(event) {
          event.preventDefault();
          const text = commentText?.value.trim();
          if (!text) {
            if (commentMessage) commentMessage.textContent = 'Please enter a comment.';
            return;
          }
          if (commentMessage) commentMessage.textContent = 'Posting...';
          try {
            const response = await fetch('/api/stories/' + storyId + '/comments', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token'),
              },
              body: JSON.stringify({ text }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to post comment.');
            if (commentText) commentText.value = '';
            if (commentMessage) commentMessage.textContent = 'Comment posted.';
            updateComments(result.comments || []);
          } catch (err) {
            if (commentMessage) commentMessage.textContent = err.message;
          }
        });
      }

      setAuthView();
    })();
  </script>
</body>
</html>`;

    res.send(html);
  });
});

function formatArticleContent(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('<p') || trimmed.includes('<div') || trimmed.includes('<br')) {
    return trimmed;
  }
  return trimmed.split(/\n\n+/).map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`).join('');
}

// Small helpers for server-side escaping
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '%22');
}

// Get featured story for homepage
app.get('/api/featured-story', async (req, res) => {
  return withDB(async (db) => {
    const featured = await db.get(`
      SELECT s.*, u.username as author, 
             (SELECT COUNT(*) FROM comments WHERE story_id = s.id) as comments
      FROM stories s 
      LEFT JOIN users u ON u.id = s.author_id 
      WHERE s.featured = 1 
      ORDER BY s.submittedAt DESC 
      LIMIT 1
    `);
    
    if (featured) {
      featured.comments = Number(featured.comments || 0);
      return res.json({ story: featured });
    }
    
    // If no featured story, return the latest story
    const latest = await db.get(`
      SELECT s.*, u.username as author,
             (SELECT COUNT(*) FROM comments WHERE story_id = s.id) as comments
      FROM stories s 
      LEFT JOIN users u ON u.id = s.author_id 
      ORDER BY s.submittedAt DESC 
      LIMIT 1
    `);
    
    if (latest) {
      latest.comments = Number(latest.comments || 0);
    }
    res.json({ story: latest || null });
  });
});

app.get('/api/breaking-news', async (req, res) => {
  return withDB(async (db) => {
    const breakingStories = await db.all(`
      SELECT s.*, u.username as author,
             (SELECT COUNT(*) FROM comments WHERE story_id = s.id) as comments
      FROM stories s
      LEFT JOIN users u ON u.id = s.author_id
      WHERE s.featured = 0 AND s.is_breaking = 1
      ORDER BY s.submittedAt DESC LIMIT 6
    `);

    const dedupedBreakingStories = (breakingStories || [])
      .filter((story) => story && story.title && (story.content || story.excerpt || story.featured_image))
      .filter((story, index, array) => array.findIndex((candidate) => (candidate.title || '').toLowerCase() === (story.title || '').toLowerCase()) === index)
      .map((story) => ({ ...story, comments: Number(story.comments || 0) }));

    if (dedupedBreakingStories.length) {
      return res.json({ stories: dedupedBreakingStories });
    }

    const latestStories = await db.all(`
      SELECT s.*, u.username as author,
             (SELECT COUNT(*) FROM comments WHERE story_id = s.id) as comments
      FROM stories s
      LEFT JOIN users u ON u.id = s.author_id
      WHERE s.featured = 0
      ORDER BY s.submittedAt DESC LIMIT 6
    `);

    const dedupedLatestStories = (latestStories || [])
      .filter((story) => story && story.title && (story.content || story.excerpt || story.featured_image))
      .filter((story, index, array) => array.findIndex((candidate) => (candidate.title || '').toLowerCase() === (story.title || '').toLowerCase()) === index)
      .map((story) => ({ ...story, comments: Number(story.comments || 0) }));

    return res.json({ stories: dedupedLatestStories });
  });
});

// Get latest stories (excluding featured or a specific story ID)
app.get('/api/latest-stories', async (req, res) => {
  const excludeId = req.query.exclude || null;
  return withDB(async (db) => {
    let query = `
      SELECT s.*, u.username as author,
             (SELECT COUNT(*) FROM comments WHERE story_id = s.id) as comments
      FROM stories s 
      LEFT JOIN users u ON u.id = s.author_id 
      WHERE s.featured = 0
    `;
    
    const params = [];
    if (excludeId) {
      query += ` AND s.id != ?`;
      params.push(excludeId);
    }
    
    query += ` ORDER BY s.submittedAt DESC LIMIT 4`;
    
    const stories = await db.all(query, params);
    const result = stories.map(s => ({
      ...s,
      comments: Number(s.comments || 0)
    }));
    res.json({ stories: result });
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  initializeDatabase()
    .then(() => app.listen(PORT, () => console.log(`API listening on ${PORT}`)))
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = app;
module.exports.initializeDatabase = initializeDatabase;
