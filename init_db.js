const bcrypt = require('bcrypt');
const { init } = require('./db');

(async () => {
  const db = await init();
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

  // seed an initial admin user if no users exist
  const existingUser = await db.get(`SELECT * FROM users LIMIT 1`);
  if (!existingUser) {
    const hash = await bcrypt.hash(process.env.INITIAL_PASSWORD || 'changeme', 10);
    await db.run(`INSERT INTO users (username, password) VALUES (?,?)`, ['admin', hash]);
    console.log('Created initial admin user: admin');
    console.log('Set INITIAL_PASSWORD in .env to change the password.');
  }

  console.log('DB initialized');
  await db.close();
})();
