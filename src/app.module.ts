import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ItemsModule } from './items/items.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Item } from './items/item.entity';

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
      synchronize: true, // must be false in production
    }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
