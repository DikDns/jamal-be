const { io } = require('socket.io-client');
require('dotenv').config({ path: ['.env', '.env.local', '.env.production'] });
const { createTLSchema, PageRecordType } = require('@tldraw/tlschema');
const { Store } = require('@tldraw/store');

const WS_URL = process.env.WS_URL || 'http://127.0.0.1:3000/collab';
const ROOM = process.env.TEST_ROOM || `collab-valid-${Date.now()}`;

console.log('Connecting to', WS_URL, 'room', ROOM);
const socket = io(WS_URL, { path: '/socket.io', transports: ['websocket'], timeout: 5000 });

socket.on('connect', async () => {
  console.log('connected', socket.id);
  socket.emit('join', { roomId: ROOM });
});

socket.on('store:state', async (s) => {
  console.log('store:state', JSON.stringify(s).slice(0, 500));

  // build a valid snapshot using TLSchema factory
  const schema = createTLSchema();
  const store = new Store({ schema: schema, props: { defaultName: 'x', assets: { upload: async ()=>({src:''}), resolve: async ()=>'', remove: async ()=>{} }, onMount: ()=>{}, collaboration: { status: null } } });

  const page = PageRecordType.create({ id: 'page:page1', name: 'Page 1', index: 'a1', meta: {} });
  // put the page into store
  store.put([page]);

  const snapshot = store.getStoreSnapshot();
  const version = (s.version ?? 0) + 1;
  console.log('emitting store:set version', version);
  socket.emit('store:set', { roomId: ROOM, store: snapshot, version });
});

socket.on('store:updated', (u) => {
  console.log('store:updated', JSON.stringify(u).slice(0, 500));
  console.log('collab valid set test success');
  socket.close();
  process.exit(0);
});

socket.on('error', (e) => {
  console.error('ws error', e);
  socket.close();
  process.exit(2);
});

setTimeout(() => { console.error('timeout'); process.exit(3); }, 10000);
