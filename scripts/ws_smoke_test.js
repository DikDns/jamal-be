const { io } = require('socket.io-client');
require('dotenv').config({ path: ['.env', '.env.local', '.env.production'] });

const WS_URL = process.env.WS_URL || 'http://127.0.0.1:3000/collab';
const API_KEY = process.env.COLLAB_API_KEY || process.env.NEXT_PUBLIC_COLLAB_API_KEY;
const ROOM_ID = process.env.ROOM_ID || 'room_123';

if (!API_KEY) {
  console.error('Missing API key. Set COLLAB_API_KEY in .env');
  process.exit(1);
}

console.log('Connecting to', WS_URL, 'room', ROOM_ID);
const socket = io(WS_URL, {
  auth: { apiKey: API_KEY },
  path: '/socket.io',
  transports: ['websocket'],
  timeout: 10000,
});

socket.on('connect_error', (err) => console.error('connect_error', err.message, err?.description));

socket.on('connected', () => {
  console.log('connected');
  socket.emit('join', { roomId: ROOM_ID });
});

socket.on('error', (e) => console.warn('ws error', e));

socket.on('store:state', (s) => {
  console.log('store:state', JSON.stringify(s).slice(0, 300));
  const nextVersion = (s?.version ?? 0) + 1;
  const nextStore = {
    schemaVersion: 1,
    records: {
      'page:page1': { id: 'page1', typeName: 'page', name: 'Page 1' },
    },
  };
  socket.emit('store:set', { roomId: ROOM_ID, store: nextStore, version: nextVersion });
});

socket.on('store:updated', (u) => {
  console.log('store:updated', JSON.stringify(u).slice(0, 300));
  // try patch next
  const baseVersion = u.version;
  socket.emit('store:patch', {
    roomId: ROOM_ID,
    baseVersion,
    changes: {
      put: [{ id: 'shape:new1', typeName: 'shape', type: 'geo', props: { geo: 'rectangle', w: 100, h: 60 } }],
      update: [{ id: 'page:page1', after: { name: 'Halaman 1' } }],
      remove: [{ id: 'shape:old' }],
    },
  });
});

setTimeout(() => {
  console.log('Test timeout, exiting.');
  socket.close();
  process.exit(0);
}, 15000);
