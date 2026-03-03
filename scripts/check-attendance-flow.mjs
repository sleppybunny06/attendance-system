import { spawn } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SERVER_START_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data };
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < SERVER_START_TIMEOUT_MS) {
    try {
      const health = await request('/api/health');
      if (health.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('Server did not become ready in time.');
}

async function main() {
  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  server.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

  try {
    await waitForServer();

    const email = `integration.${Date.now()}@example.com`;
    const password = 'pass123';

    const register = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Integration User', email, password, department: 'QA' },
    });
    if (register.status !== 200 || register.data?.success !== true) {
      throw new Error(`Register failed: ${JSON.stringify(register)}`);
    }

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (login.status !== 200 || !login.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(login)}`);
    }
    const token = login.data.token;

    const todayBefore = await request('/api/attendance/today', { token });
    if (todayBefore.status !== 200 || todayBefore.data !== null) {
      throw new Error(`Expected no attendance before punch-in: ${JSON.stringify(todayBefore)}`);
    }

    const punchIn = await request('/api/attendance/punch-in', { method: 'POST', token });
    if (punchIn.status !== 200 || punchIn.data?.success !== true) {
      throw new Error(`Punch-in failed: ${JSON.stringify(punchIn)}`);
    }

    const punchOut = await request('/api/attendance/punch-out', { method: 'POST', token });
    if (punchOut.status !== 200 || punchOut.data?.success !== true) {
      throw new Error(`Punch-out failed: ${JSON.stringify(punchOut)}`);
    }

    const todayAfter = await request('/api/attendance/today', { token });
    if (todayAfter.status !== 200 || !todayAfter.data?.punch_in || !todayAfter.data?.punch_out) {
      throw new Error(`Expected punch-in and punch-out timestamps: ${JSON.stringify(todayAfter)}`);
    }

    const history = await request('/api/attendance/history', { token });
    if (history.status !== 200 || !Array.isArray(history.data) || history.data.length === 0) {
      throw new Error(`Expected attendance history record: ${JSON.stringify(history)}`);
    }

    console.log('✅ Attendance flow check passed.');
  } finally {
    server.kill('SIGINT');
  }
}

main().catch((error) => {
  console.error('❌ Attendance flow check failed:', error.message);
  process.exit(1);
});
