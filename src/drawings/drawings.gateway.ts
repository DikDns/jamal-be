import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drawing } from './drawing.entity';

@WebSocketGateway({ cors: true })
export class DrawingsGateway {
  @WebSocketServer() server: Server;

  constructor(
    @InjectRepository(Drawing)
    private drawingsRepo: Repository<Drawing>,
  ) {}

  @SubscribeMessage('joinDrawing')
  handleJoin(@MessageBody() data: { drawingId: string }, @ConnectedSocket() client: Socket) {
    const room = data.drawingId;
    client.join(room);
    return { ok: true };
  }

  @SubscribeMessage('drawing:update')
  async handleUpdate(@MessageBody() data: { drawingId: string; store: any }) {
    const { drawingId, store } = data;
    if (!drawingId || !store) return { ok: false, error: 'invalid payload' };
    await this.drawingsRepo.update(drawingId, { store } as any);
    this.server.to(drawingId).emit('drawing:patch', { drawingId, store });
    return { ok: true };
  }
}
