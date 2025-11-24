const { io } = require('socket.io-client');
require('dotenv').config({ path: ['.env', '.env.local', '.env.production'] });

const WS_URL = process.env.WS_URL || 'http://127.0.0.1:3000';
const PATH = '/socket.io';

console.log('Connecting to', WS_URL);
const socket = io(WS_URL, { path: PATH, transports: ['websocket'], timeout: 5000 });

socket.on('connect', () => {
  console.log('connected, id=', socket.id);
  const drawingId = process.env.SMOKE_DRAWING_ID || null;
  if (!drawingId) {
    console.log('No SMOKE_DRAWING_ID set; creating temporary drawing via REST...');
    // create via REST
    // use global fetch (Node 18+) instead of node-fetch
    (async () => {
      try {
        const res = await fetch(`${WS_URL}/drawings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'ws-smoke', store: { ok: true } }) });
        const body = await res.json();
        const id = body.id;
        console.log('created drawing', id);
        joinAndTest(id);
      } catch (err) {
        console.error('create drawing failed', err);
        process.exit(2);
      }
    })();
  } else {
    joinAndTest(drawingId);
  }
});

function joinAndTest(id) {
  console.log('Joining drawing', id);
  socket.emit('joinDrawing', { drawingId: id });

  socket.emit('drawing:update', { drawingId: id, store: { test: true, ts: Date.now() } });

  socket.on('drawing:patch', (msg) => {
    console.log('received drawing:patch', JSON.stringify(msg).slice(0, 400));
    console.log('WS smoke test success.');
    socket.close();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Timeout waiting for drawing:patch');
    socket.close();
    process.exit(3);
  }, 5000);
}

socket.on('connect_error', (err) => { console.error('connect_error', err); process.exit(4); });

setTimeout(() => { console.error('overall timeout'); process.exit(5); }, 15000);
