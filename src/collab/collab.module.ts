import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollabGateway } from './collab.gateway';
import { CollabService } from './collab.service';
import { Drawing } from './drawing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Drawing])],
  providers: [CollabGateway, CollabService],
})
export class CollabModule {}
