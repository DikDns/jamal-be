import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';


@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>) {}

  create(data: Partial<Item>) {
    const item = this.itemsRepository.create(data);
    return this.itemsRepository.save(item);
  }

  findAll() {
    return this.itemsRepository.find();
  }

  findOne(id: number) {
    return this.itemsRepository.findOneBy({ id });
  }

  async update(id: number, data: Partial<Item>) {
    await this.itemsRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    if (!item) {
      throw new NotFoundException(`Item dengan ID ${id} tidak ditemukan`);
    }
    return this.itemsRepository.remove(item);
  }
}
