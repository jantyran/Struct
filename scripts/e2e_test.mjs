import assert from 'node:assert';
import { SignJWT } from 'jose';

const BASE_URL = 'http://127.0.0.1:3002';
const JWT_SECRET = new TextEncoder().encode('change-this-in-production');

async function createToken(userId) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(JWT_SECRET);
}

const adminUserId = '47f81c1a-a89d-407c-b572-9ce6022fc192';
const normalUserId = '15b0a126-8077-48ff-aba6-b1b48e23d9e1';
const projectId = '4cca5d88-3f7b-49bc-8001-628c697b46c0';

const adminToken = await createToken(adminUserId);
const normalUserToken = await createToken(normalUserId);

const adminHeaders = {
  Cookie: `session=${adminToken}`,
  'Content-Type': 'application/json',
};

const normalHeaders = {
  Cookie: `session=${normalUserToken}`,
  'Content-Type': 'application/json',
};

console.log('--- 1. Testing Unauthenticated Access (Must be 401) ---');

for (const path of [
  `/api/dashboard`,
  `/api/ai-settings`,
  `/api/projects/${projectId}`,
  `/api/projects/${projectId}/notes`,
  `/api/projects/${projectId}/assets`,
]) {
  const res = await fetch(`${BASE_URL}${path}`);
  assert.strictEqual(res.status, 401, `Unauthenticated ${path} must be 401, got ${res.status}`);
}
console.log('✓ Unauthenticated requests correctly returned 401');

console.log('--- 2. Testing Admin Authenticated Access (200 OK) ---');

// /api/auth/me
{
  const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/auth/me failed: ${res.status}`);
  const data = await res.json();
  assert(data.user, 'user should be present in /api/auth/me');
  assert.strictEqual(data.user.system_role, 'SYSTEM_ADMIN');
  console.log('✓ /api/auth/me succeeded');
}

// /api/dashboard
{
  const res = await fetch(`${BASE_URL}/api/dashboard`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/dashboard failed: ${res.status}`);
  const data = await res.json();
  assert(Array.isArray(data.projects), 'dashboard projects must be array');
  console.log(`✓ /api/dashboard succeeded (found ${data.projects.length} projects)`);
}

// /api/ai-settings
{
  const res = await fetch(`${BASE_URL}/api/ai-settings`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/ai-settings failed: ${res.status}`);
  const data = await res.json();
  assert(data.settings, 'ai-settings must have settings');
  console.log('✓ /api/ai-settings succeeded');
}

// /api/projects/[id]
{
  const res = await fetch(`${BASE_URL}/api/projects/${projectId}`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/projects/[id] failed: ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.id, projectId);
  assert(Array.isArray(data.custom_fields), 'custom_fields must be array');
  assert(data.current_permissions, 'current_permissions must exist');
  assert.strictEqual(data.current_permissions.can_view, true);
  assert.strictEqual(data.current_permissions.can_edit, true);
  console.log('✓ /api/projects/[id] GET succeeded');
}

// /api/projects/[id]/relations
{
  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/relations`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/projects/[id]/relations failed: ${res.status}`);
  const data = await res.json();
  assert(data.rollup !== undefined, 'relations must contain rollup');
  assert(typeof data.rollup.todo_total === 'number', 'rollup.todo_total must be number');
  assert(typeof data.rollup.todo_done === 'number', 'rollup.todo_done must be number');
  console.log('✓ /api/projects/[id]/relations succeeded with subquery rollup');
}

// /api/projects/[id]/notes (CRUD)
{
  // GET
  const resGet = await fetch(`${BASE_URL}/api/projects/${projectId}/notes`, { headers: adminHeaders });
  assert.strictEqual(resGet.status, 200);
  const initialNotes = await resGet.json();
  assert(Array.isArray(initialNotes));

  // POST create
  const testTitle = `Refactor test note ${Date.now()}`;
  const resPost = await fetch(`${BASE_URL}/api/projects/${projectId}/notes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: testTitle, body: 'Note body test' }),
  });
  assert.strictEqual(resPost.status, 201, `Create note failed: ${resPost.status}`);
  const createdNote = await resPost.json();
  assert.strictEqual(createdNote.title, testTitle);

  // PATCH update
  const updatedTitle = `${testTitle} updated`;
  const resPatch = await fetch(`${BASE_URL}/api/projects/${projectId}/notes/${createdNote.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ title: updatedTitle }),
  });
  assert.strictEqual(resPatch.status, 200, `Patch note failed: ${resPatch.status}`);
  const patchedNote = await resPatch.json();
  assert.strictEqual(patchedNote.title, updatedTitle);

  // DELETE
  const resDelete = await fetch(`${BASE_URL}/api/projects/${projectId}/notes/${createdNote.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.strictEqual(resDelete.status, 200, `Delete note failed: ${resDelete.status}`);
  console.log('✓ /api/projects/[id]/notes CRUD succeeded');
}

// /api/projects/[id]/assets
{
  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/assets`, { headers: adminHeaders });
  assert.strictEqual(res.status, 200, `/api/projects/[id]/assets failed: ${res.status}`);
  const data = await res.json();
  assert(Array.isArray(data), 'assets must be array');
  console.log(`✓ /api/projects/[id]/assets succeeded (found ${data.length} assets)`);
}

// PUT /api/projects/[id]
{
  const res = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'ファーマソリューション セミナー' }),
  });
  assert.strictEqual(res.status, 200, `PUT /api/projects/[id] failed: ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.name, 'ファーマソリューション セミナー');
  console.log('✓ /api/projects/[id] PUT succeeded');
}

console.log('--- 3. Testing Permission Boundaries (Normal User) ---');

// Normal user accessing ai-settings -> must be 403 Forbidden
{
  const res = await fetch(`${BASE_URL}/api/ai-settings`, { headers: normalHeaders });
  assert.strictEqual(res.status, 403, `Normal user on /api/ai-settings should be 403, got ${res.status}`);
  console.log('✓ Permission boundary check succeeded (normal user blocked with 403)');
}

// Non-existent project -> must be 404
{
  const res = await fetch(`${BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000`, { headers: adminHeaders });
  assert.strictEqual(res.status, 404, `Non-existent project must be 404, got ${res.status}`);
  console.log('✓ 404 Not Found check succeeded');
}

console.log('\n========================================');
console.log('🎉 ALL END-TO-END REFACTOR TESTS PASSED');
console.log('========================================');
