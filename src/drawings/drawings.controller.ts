import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { DrawingsService } from './drawings.service';

@Controller('drawings')
export class DrawingsController {
  constructor(private readonly svc: DrawingsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() body: { name?: string; store: any }) {
    return this.svc.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<{ name: string; store: any }>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
