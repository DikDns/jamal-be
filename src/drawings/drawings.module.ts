import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drawing } from './drawing.entity';
import { DrawingsGateway } from './drawings.gateway';
import { DrawingsService } from './drawings.service';
import { DrawingsController } from './drawings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Drawing])],
  providers: [DrawingsGateway, DrawingsService],
  controllers: [DrawingsController],
})
export class DrawingsModule {}
