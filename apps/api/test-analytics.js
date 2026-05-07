const baseUrl = 'http://localhost:3000/api/v1';

async function test() {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'oni@test.com', password: 'TestPass123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  if (!token) {
    console.error("Login failed", loginData);
    return;
  }

  const endpoints = [
    '/analytics/kpis',
    '/analytics/funnel',
    '/analytics/source-attribution',
    '/analytics/department-heatmap',
    '/analytics/activity-feed',
    '/analytics/time-to-hire'
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`\n=== ${ep} (Status: ${res.status}) ===`);
    console.log(JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '\n... (truncated)' : ''));
  }
}

test();
