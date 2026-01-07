import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiServiceService } from './ai-service.service';
import type {
  HealthResponse,
  DebugResponse,
  SimilarityRequest,
  SimilarityResponse,
  GroupRequest,
  GroupResponse,
} from './ai-service.service';

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

  @Post('similarity')
  async checkSimilarity(@Body() request: SimilarityRequest): Promise<SimilarityResponse> {
    return this.aiServiceService.checkSimilarity(request);
  }

  @Post('group')
  async groupIdeas(@Body() request: GroupRequest): Promise<GroupResponse> {
    return this.aiServiceService.groupIdeas(request);
  }
}
