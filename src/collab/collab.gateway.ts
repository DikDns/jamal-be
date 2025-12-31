import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollabService, TLStore } from './collab.service';

// Payload types
interface JoinPayload { roomId: string }
interface StoreGetPayload { roomId: string }
interface StoreSetPayload { roomId: string; store: TLStore; version: number }
interface StorePatchPayload {
  roomId: string;
  baseVersion: number;
  changes: {
    put?: Record<string, any>[];
    update?: { id: string; after: Record<string, any> }[];
    remove?: { id: string }[];
  };
}

@WebSocketGateway({
  namespace: '/collab',
  cors: { origin: '*' },
})
export class CollabGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly collab: CollabService) { }

  handleConnection(client: Socket) {
    // Strict auth validation: accept only auth object, Authorization header, or cookies
    // REJECT query params (security: API key must not be in URL)
    const expected = process.env.COLLAB_API_KEY;
    if (!expected) {
      // No API key required; allow connection
      client.emit('connected', { ok: true });
      return;
    }

    let apiKey: string | undefined;

    // 1. Check socket.io auth object
    apiKey = client.handshake.auth?.apiKey || client.handshake.auth?.collabKey;

    // 2. Check Authorization header (Bearer token)
    if (!apiKey) {
      const authHeader = client.handshake.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7);
      }
    }

    // 3. Check cookies (HttpOnly cookie named 'collabKey' or 'apiKey')
    if (!apiKey && client.handshake.headers?.cookie) {
      const cookies = client.handshake.headers.cookie
        .split(';')
        .map((c) => c.trim())
        .reduce((acc, c) => {
          const [key, val] = c.split('=');
          acc[key] = val;
          return acc;
        }, {} as Record<string, string>);
      apiKey = cookies['collabKey'] || cookies['apiKey'];
    }

    // 4. Explicitly reject query params (DO NOT accept apiKey from client.handshake.query)
    if (client.handshake.query?.apiKey || client.handshake.query?.collabKey) {
      client.emit('error', { code: 'UNAUTHENTICATED', message: 'API key cannot be passed in URL query parameters' });
      client.disconnect(true);
      return;
    }

    // Validate extracted key
    if (!apiKey || apiKey !== expected) {
      client.emit('error', { code: 'UNAUTHENTICATED', message: 'Invalid or missing API key' });
      client.disconnect(true);
      return;
    }

    client.emit('connected', { ok: true });
  }

  @SubscribeMessage('join')
  async handleJoin(@MessageBody() body: JoinPayload, @ConnectedSocket() client: Socket) {
    const { roomId } = body;
    await client.join(roomId);
    const doc = await this.collab.getOrCreate(roomId);
    client.emit('store:state', { roomId, store: doc.store, version: doc.version });
  }

  @SubscribeMessage('store:get')
  async handleGet(@MessageBody() body: StoreGetPayload, @ConnectedSocket() client: Socket) {
    const { roomId } = body;
    const doc = await this.collab.getOrCreate(roomId);
    client.emit('store:state', { roomId, store: doc.store, version: doc.version });
  }

  @SubscribeMessage('store:set')
  async handleSet(@MessageBody() body: StoreSetPayload) {
    try {
      // Limit payload size (~2MB) to prevent abuse
      const approx = JSON.stringify(body?.store ?? {}).length;
      if (approx > 2_000_000) {
        throw new Error('PAYLOAD_TOO_LARGE');
      }
      const { roomId, store, version } = body;
      const updated = await this.collab.setStore(roomId, store, version);
      this.server.to(roomId).emit('store:updated', { roomId, store: updated.store, version: updated.version });
    } catch (err: any) {
      this.emitError(body?.roomId, err);
    }
  }

  @SubscribeMessage('store:patch')
  async handlePatch(@MessageBody() body: StorePatchPayload) {
    try {
      const approx = JSON.stringify(body?.changes ?? {}).length;
      if (approx > 1_000_000) {
        throw new Error('PAYLOAD_TOO_LARGE');
      }
      const { roomId, baseVersion, changes } = body;
      const updated = await this.collab.applyPatch(roomId, baseVersion, changes);
      this.server.to(roomId).emit('store:updated', { roomId, store: updated.store, version: updated.version });
    } catch (err: any) {
      this.emitError(body?.roomId, err);
    }
  }

  // Ephemeral presence update - broadcasts cursor position without DB persistence
  @SubscribeMessage('presence:update')
  handlePresence(
    @MessageBody() body: { roomId: string; odId: string; name: string; color: string; cursor: { x: number; y: number } | null },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, odId, name, color, cursor } = body;
    // Broadcast to everyone in the room except sender
    client.to(roomId).emit('presence:updated', { roomId, odId, name, color, cursor });
  }

  private emitError(roomId: string | undefined, err: any) {
    const code = this.mapErrorCode(err);
    const payload = { code, message: this.safeMessage(err) };
    if (roomId) this.server.to(roomId).emit('error', payload);
  }

  private mapErrorCode(err: any): string {
    const msg = String(err?.message || '').toUpperCase();
    if (msg.includes('PAYLOAD_TOO_LARGE')) return 'PAYLOAD_TOO_LARGE';
    if (msg.includes('VERSION CONFLICT') || msg.includes('CONCURRENT UPDATE')) return 'VERSION_CONFLICT';
    if (msg.includes('NOT FOUND')) return 'NOT_FOUND';
    if (msg.includes('INVALID') || msg.includes('BAD REQUEST')) return 'INVALID_PAYLOAD';
    return 'INTERNAL_ERROR';
  }

  private safeMessage(err: any): string {
    const msg = String(err?.message || 'Internal error');
    return msg.length > 500 ? msg.slice(0, 500) : msg;
  }
}
