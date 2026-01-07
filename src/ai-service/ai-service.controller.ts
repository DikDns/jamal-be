import { Controller, Get } from '@nestjs/common';
import { AiServiceService, HealthResponse, DebugResponse } from './ai-service.service';

@Controller('ai-service')
export class AiServiceController {
    constructor(private readonly aiServiceService: AiServiceService) { }

    @Get('health')
    async getHealth(): Promise<HealthResponse> {
        return this.aiServiceService.getHealth();
    }

    @Get('debug')
    async getDebug(): Promise<DebugResponse> {
        return this.aiServiceService.getDebug();
    }
}
