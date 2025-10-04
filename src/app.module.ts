import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ItemsModule } from './items/items.module';

@Module({
    imports: [DatabaseModule, ItemsModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
