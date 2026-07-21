require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { init } = require('./db');

async function initializeDatabase() {
  const db = await init();
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
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

    const existingUser = await db.get(`SELECT * FROM users LIMIT 1`);
    if (!existingUser) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash(process.env.INITIAL_PASSWORD || 'changeme', 10);
      await db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hash]);
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
        },
        {
          title: 'Local roads and transport links gain momentum ahead of the busy season',
          category: 'Business',
          content: 'Business owners and commuters say the latest upgrades are cutting travel time and improving access to key growth corridors.',
          excerpt: 'Business owners and commuters say the latest upgrades are cutting travel time and improving access to key growth corridors.',
          featured_image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80',
          reading_time: 5,
        },
        {
          title: 'School and youth programmes expand as community leaders back local learning',
          category: 'Education',
          content: 'New partnerships are helping young people stay engaged through mentorship, arts and practical learning opportunities.',
          excerpt: 'New partnerships are helping young people stay engaged through mentorship, arts and practical learning opportunities.',
          featured_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
          reading_time: 3,
        }
      ];

      const user = await db.get(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
      for (const story of sampleStories) {
        await db.run(`
          INSERT INTO stories (title, category, content, author_id, submittedAt, views, featured, featured_image, excerpt, reading_time)
          VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
        `, [story.title, story.category, story.content, user?.id || null, now, story.featured_image, story.excerpt, story.reading_time]);
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
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
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
    const r = await db.run(`INSERT INTO users (username, password) VALUES (?,?)`, [username, hash]);
    const user = await db.get(`SELECT id, username FROM users WHERE id = ?`, [r.lastID]);
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
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
