import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ItemsModule } from './items/items.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Item } from './items/item.entity';
import { CollabModule } from './collab/collab.module';
import { DrawingsModule } from './drawings/drawings.module';
import { AiServiceModule } from './ai-service/ai-service.module';

@Module({
  imports: [
    DatabaseModule,
    ItemsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL!,
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: false, // disable automatic schema sync; use migrations instead
    }),
    CollabModule,
    DrawingsModule,
    AiServiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
