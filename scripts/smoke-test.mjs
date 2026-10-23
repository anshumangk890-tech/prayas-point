import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
let cookie = '';
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sessionCookie = response.headers.get('set-cookie');
  if (sessionCookie?.startsWith('exam_session=')) cookie = sessionCookie.split(';')[0];
  const data = await response.json();
  return { status: response.status, data };
}

try {
  const guest = await request('/api/bootstrap');
  assert.equal(guest.status, 200);
  const signedIn = await request('/api/auth', 'POST', { action: 'guest' });
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.data.data.user.isDemo, true); // Legacy database flag for an unverified session.
  assert.equal(signedIn.data.data.user.verifiedPhone, false);
  assert.ok(signedIn.data.data.user.id.startsWith('guest-'));
  assert.ok(signedIn.data.data.quizzes.length > 0);
  const denied = await request('/api/admin');
  assert.equal(denied.status, 403);
  const topic = await request('/api/profile', 'POST', { action: 'toggleTopic', topicId: 'percentages' });
  assert.equal(topic.data.completed, true);
  const started = await request('/api/attempts', 'POST', { action: 'start', quizId: 'daily-starter' });
  assert.equal(started.status, 200);
  assert.equal(started.data.questions.length, 6);
  assert.ok(!('correctAnswers' in started.data.questions[0]));
  const attemptId = started.data.attempt.id;
  const invalid = await request('/api/attempts', 'POST', { action: 'save', attemptId, answers: { 'sample-q1': ['INVALID'] }, reviewIds: [] });
  assert.equal(invalid.status, 400);
  const saved = await request('/api/attempts', 'POST', { action: 'save', attemptId, answers: { 'sample-q1': ['C'] }, reviewIds: ['sample-q1'] });
  assert.equal(saved.status, 200);
  const submitted = await request('/api/attempts', 'POST', { action: 'submit', attemptId, answers: { 'sample-q1': ['C'] }, reviewIds: ['sample-q1'] });
  assert.equal(submitted.data.attempt.status, 'submitted');
  assert.equal(submitted.data.attempt.score, 1);
  assert.equal(submitted.data.review.length, 6);
  const duplicate = await request('/api/attempts', 'POST', { action: 'submit', attemptId, answers: {}, reviewIds: [] });
  assert.equal(duplicate.data.attempt.score, 1);
  const persisted = await request('/api/bootstrap');
  assert.equal(persisted.data.data.completedTopicIds.length, 1);
  assert.equal(persisted.data.data.attempts.length, 1);
  assert.equal(persisted.data.data.subjectPerformance.maths.correct, 1);
  console.log('PASS: guest session, published content, owner data, answer hiding, validation, scoring, idempotency, progress and admin denial');
} finally {
  if (cookie) {
    const removed = await request('/api/profile', 'DELETE', { confirmation: 'DELETE' });
    assert.equal(removed.status, 200, 'temporary guest study account cleanup');
  }
}
