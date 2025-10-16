import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from './item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],  // Ini penting!
  controllers: [ItemsController],
  providers: [ItemsService]
})
export class ItemsModule {}