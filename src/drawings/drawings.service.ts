import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drawing } from './drawing.entity';

@Injectable()
export class DrawingsService {
  constructor(
    @InjectRepository(Drawing)
    private drawingsRepo: Repository<Drawing>,
  ) {}

  create(payload: { name?: string; store: any }) {
    if (!payload?.store) throw new BadRequestException('store is required');
    const d = this.drawingsRepo.create({ name: payload.name, store: payload.store });
    return this.drawingsRepo.save(d);
  }

  findAll() {
    return this.drawingsRepo.find({ select: ['id', 'name', 'created_at', 'updated_at'] });
  }

  findOne(id: string) {
    return this.drawingsRepo.findOneBy({ id });
  }

  async update(id: string, payload: Partial<{ name: string; store: any }>) {
    const exists = await this.findOne(id);
    if (!exists) throw new NotFoundException(`Drawing ${id} not found`);
    await this.drawingsRepo.update(id, { ...payload } as any);
    return this.findOne(id);
  }

  async remove(id: string) {
    const d = await this.findOne(id);
    if (!d) throw new NotFoundException(`Drawing ${id} not found`);
    return this.drawingsRepo.remove(d);
  }
}
