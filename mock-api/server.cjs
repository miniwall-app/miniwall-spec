#!/usr/bin/env node
// A tiny stand-in for the Miniwall delivery API (/v1/sdk/...) that serves the screens in mock-api/ui. No dependencies.
// Used by the Flutter integration test, the React Native Detox/Maestro flows and by hand:
//   node mock-api/server.cjs [port]            (default 8799; 0 picks a free port)
// Android emulator reaches it at http://10.0.2.2:8799, the iOS simulator at http://127.0.0.1:8799.
//   GET  /v1/sdk/placements/<name>   placements.json   (onboarding, flow, capped, holdout, toast)
//   GET  /v1/sdk/paywalls/<id>       paywalls.json     (flow_question, flow_done)
//   POST /v1/sdk/events              records the batch; GET /__admin/events lists what arrived
//   GET  /__admin/offline?on=1|0     on: every request drops the connection (the SDK must use its cache)
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'ui');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const placements = read('placements.json');
const paywalls = read('paywalls.json');
const events = [];
let offline = false;

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__admin/offline') {
    offline = url.searchParams.get('on') === '1';
    return send(res, 200, { offline });
  }
  if (url.pathname === '/__admin/events') return send(res, 200, events);
  if (offline) return req.socket.destroy();
  const place = url.pathname.match(/^\/v1\/sdk\/placements\/([^/]+)$/);
  const paywall = url.pathname.match(/^\/v1\/sdk\/paywalls\/([^/]+)$/);
  if (req.method === 'GET' && place) {
    const body = placements[decodeURIComponent(place[1])];
    return body ? send(res, 200, body) : send(res, 404, { error: { message: 'unknown placement' } });
  }
  if (req.method === 'GET' && paywall) {
    const body = paywalls[decodeURIComponent(paywall[1])];
    return body ? send(res, 200, body) : send(res, 404, { error: { message: 'unknown screen' } });
  }
  if (req.method === 'POST' && url.pathname === '/v1/sdk/events') {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { events.push(...JSON.parse(data).events); } catch { /* ignore */ }
      send(res, 200, {});
    });
    return;
  }
  send(res, 404, { error: { message: 'not found' } });
});

const port = Number(process.argv[2] || 8799);
server.listen(port, '0.0.0.0', () => console.log(`miniwall mock API on :${server.address().port}`));
