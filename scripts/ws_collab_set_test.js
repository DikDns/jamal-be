const { io } = require('socket.io-client');
require('dotenv').config({ path: ['.env', '.env.local', '.env.production'] });

const WS_URL = process.env.WS_URL || 'http://127.0.0.1:3000/collab';
const ROOM = process.env.TEST_ROOM || `collab-smoke-${Date.now()}`;

console.log('Connecting to', WS_URL, 'room', ROOM);
const socket = io(WS_URL, { path: '/socket.io', transports: ['websocket'], timeout: 5000 });

socket.on('connect', () => {
  console.log('connected', socket.id);
  socket.emit('join', { roomId: ROOM });
});

socket.on('store:state', (s) => {
  console.log('store:state', JSON.stringify(s).slice(0, 500));
  // send a valid TLStore snapshot
  const snapshot = {
    schemaVersion: 1,
    records: {
      'page:page1': { id: 'page1', typeName: 'page', name: 'Page 1' },
      'shape:rect1': { id: 'shape:rect1', typeName: 'shape', type: 'geo', props: { geo: 'rectangle', w: 80, h: 60 } }
    }
  };
  const version = (s.version ?? 0) + 1;
  console.log('emitting store:set version', version);
  socket.emit('store:set', { roomId: ROOM, store: snapshot, version });
});

socket.on('store:updated', (u) => {
  console.log('store:updated', JSON.stringify(u).slice(0, 500));
  console.log('collab set test success');
  socket.close();
  process.exit(0);
});

socket.on('error', (e) => {
  console.error('ws error', e);
  socket.close();
  process.exit(2);
});

setTimeout(() => { console.error('timeout'); process.exit(3); }, 10000);
