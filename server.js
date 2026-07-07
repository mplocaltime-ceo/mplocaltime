require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const { init } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(express.static(path.join(__dirname, '/public')));

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

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on ${PORT}`));
}

module.exports = app;
