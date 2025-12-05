import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Controller('/')
@UseGuards(ApiKeyGuard)
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  async getTable() {
    return 'ke /items';
  }
}