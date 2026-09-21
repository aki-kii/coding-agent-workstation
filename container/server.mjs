import { createServer } from 'node:http';

// AgentCore keeps the session alive while /ping reports HealthyBusy. The construct passes how
// long to keep reporting it after the last activity.
const idlePaddingSeconds = Number(process.env.WORKSTATION_IDLE_PADDING_SECONDS ?? 0);

let lastActivity = Date.now();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/ping') {
    const idleFor = (Date.now() - lastActivity) / 1000;
    const status = idleFor < idlePaddingSeconds ? 'HealthyBusy' : 'Healthy';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status }));
    return;
  }

  if (url.pathname === '/invocations') {
    lastActivity = Date.now();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hostname: process.env.HOSTNAME ?? '', home: process.env.HOME }));
    return;
  }

  res.writeHead(404).end();
});

server.listen(8080, '0.0.0.0');
