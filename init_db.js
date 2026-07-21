const bcrypt = require('bcrypt');
const { init } = require('./db');

(async () => {
  const db = await init();
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

  // add missing author metadata columns for older databases
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
  }

  // seed an initial admin user if no users exist
  const existingAdmin = await db.get(`SELECT id FROM users WHERE username = ?`, ['admin']);
  if (!existingAdmin) {
    const hash = await bcrypt.hash(process.env.INITIAL_PASSWORD || 'changeme', 10);
    await db.run(`INSERT INTO users (username, password, bio, avatar, role) VALUES (?,?,?,?,?)`, ['admin', hash, 'Publisher and managing editor of Mpumalanga Local Time.', '/logo.png', 'admin']);
    console.log('Created initial admin user: admin');
    console.log('Set INITIAL_PASSWORD in .env to change the password.');
  }

  const existingReporter = await db.get(`SELECT id FROM users WHERE username = ?`, ['reporter']);
  if (!existingReporter) {
    const hash = await bcrypt.hash(process.env.INITIAL_USER_PASSWORD || 'contributor', 10);
    await db.run(`INSERT INTO users (username, password, bio, avatar, role) VALUES (?,?,?,?,?)`, ['reporter', hash, 'Contributor covering local stories across Mpumalanga.', '/logo.png', 'user']);
    console.log('Created default contributor user: reporter');
    console.log('Set INITIAL_USER_PASSWORD in .env to change the password.');
  }

  console.log('DB initialized');
  await db.close();
})();
