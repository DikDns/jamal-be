import { Module } from '@nestjs/common';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';

@Module({
    controllers: [AiServiceController],
    providers: [AiServiceService],
    exports: [AiServiceService],
})
export class AiServiceModule { }
