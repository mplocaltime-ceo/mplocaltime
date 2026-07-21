const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeDatabase } = require('../server');
const app = require('../server');

test('breaking news endpoint returns stories', async () => {
  await initializeDatabase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/breaking-news`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload.stories));
    assert.ok(payload.stories.length > 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
