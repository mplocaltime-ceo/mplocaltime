const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeDatabase } = require('../server');
const app = require('../server');
const { buildLatestUpdatesMarkup } = require('../main');

test('buildLatestUpdatesMarkup renders story cards', () => {
  const markup = buildLatestUpdatesMarkup([
    { id: 1, title: 'Local road upgrades continue', excerpt: 'Residents welcome the new work.', category: 'Community', submittedAt: '2026-07-21T08:00:00Z', reading_time: 3, featured_image: '/logo.png' },
    { id: 2, title: 'Business forum expands next month', excerpt: 'Entrepreneurs prepare for fresh opportunities.', category: 'Business', submittedAt: '2026-07-21T09:00:00Z', reading_time: 4, featured_image: '/logo.png' },
  ]);

  assert.match(markup, /latest-update-card/);
  assert.ok(markup.includes('Local road upgrades continue'));
  assert.ok(markup.includes('Business forum expands next month'));
});

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

test('story update endpoint persists workflow changes', async () => {
  await initializeDatabase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const loginResponse = await fetch(`http://127.0.0.1:${address.port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'changeme' }),
    });
    const loginPayload = await loginResponse.json();

    const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginPayload.token}`,
      },
      body: JSON.stringify({ title: 'Editorial workflow test', category: 'News', content: 'Draft content', status: 'draft' }),
    });
    const created = await createResponse.json();

    const updateResponse = await fetch(`http://127.0.0.1:${address.port}/api/stories/${created.story.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginPayload.token}`,
      },
      body: JSON.stringify({ status: 'pending-review', editorial_notes: 'Needs fact-check' }),
    });
    const updated = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.story.status, 'pending-review');
    assert.match(updated.story.editorial_notes || '', /fact-check/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('search endpoint returns story matches', async () => {
  await initializeDatabase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/search?q=health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload.results));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('media upload endpoint stores a file', async () => {
  await initializeDatabase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const loginResponse = await fetch(`http://127.0.0.1:${address.port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'changeme' }),
    });
    const loginPayload = await loginResponse.json();

    const form = new FormData();
    form.append('file', new Blob(['hello world'], { type: 'text/plain' }), 'sample.txt');
    form.append('caption', 'Sample upload');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginPayload.token}` },
      body: form,
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.media && payload.media.id);
    assert.match(payload.media.original_name || '', /sample\.txt/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
