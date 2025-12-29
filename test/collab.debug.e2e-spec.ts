/**
 * Minimal Debug Test - Check if store:set works at all
 */
import { io, Socket } from 'socket.io-client';

describe('Debug: Store Set/Patch', () => {
  let socket: Socket;
  const baseUrl = 'http://localhost:3000';

  afterEach((done) => {
    if (socket?.connected) socket.disconnect();
    setTimeout(done, 100);
  });

  it('DEBUG: store:set should work or return error', (done) => {
    socket = io(`${baseUrl}/collab`, {
      transports: ['websocket'],
      auth: { apiKey: process.env.COLLAB_API_KEY },
    });

    const testRoomId = 'debug-set-' + Date.now();
    let gotStoreState = false;

    // Listen to ALL events
    socket.onAny((event, ...args) => {
      console.log(`[EVENT] ${event}:`, JSON.stringify(args).slice(0, 200));
    });

    socket.on('connected', () => {
      console.log('[1] Connected, joining room:', testRoomId);
      socket.emit('join', { roomId: testRoomId });
    });

    socket.on('store:state', (data) => {
      if (gotStoreState) return; // Prevent duplicate handling
      gotStoreState = true;

      const version = data.version;
      console.log('[2] Got store:state, version:', version);
      console.log('[2] Store content:', JSON.stringify(data.store).slice(0, 200));

      // Use the EXACT store format we received, just increment version
      const payload = {
        roomId: testRoomId,
        store: data.store, // Use same store we received
        version: version + 1,
      };

      console.log('[3] Sending store:set with version:', payload.version);
      socket.emit('store:set', payload);

      // Wait for either store:updated or error
      setTimeout(() => {
        console.log('[TIMEOUT] No response after 5s');
        done(new Error('No response from server after store:set'));
      }, 5000);
    });

    socket.on('store:updated', (data) => {
      console.log('[4] SUCCESS! store:updated received, version:', data.version);
      done();
    });

    socket.on('error', (error) => {
      console.log('[ERROR] Received error:', JSON.stringify(error));
      done(new Error(`Server error: ${error.code} - ${error.message}`));
    });
  }, 10000);
});
