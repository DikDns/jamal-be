import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drawing } from './drawing.entity';
import { z } from 'zod';

export type TLStore = {
  schemaVersion?: number;
  records?: Record<string, any>;
};

// Minimal validation: TLStore with records object; TLRecord must have id & typeName
const TLRecordSchema = z.object({
  id: z.string(),
  typeName: z.string(),
}).passthrough();

const TLStoreSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  records: z.record(TLRecordSchema).default({}),
});

@Injectable()
export class CollabService {
  constructor(
    @InjectRepository(Drawing)
    private readonly drawings: Repository<Drawing>,
  ) {}

  private emptyStore(): TLStore {
    return { schemaVersion: 1, records: {} };
  }

  async getOrCreate(roomId: string): Promise<Drawing> {
    let doc = await this.drawings.findOne({ where: { roomId } });
    if (!doc) {
      doc = this.drawings.create({
        roomId,
        name: `Room ${roomId}`,
        store: this.emptyStore(),
        version: 0,
      });
      doc = await this.drawings.save(doc);
    }
    return doc;
  }

  // Set full store with optimistic concurrency (version must be prev+1)
  async setStore(roomId: string, nextStore: TLStore, nextVersion: number): Promise<Drawing> {
    // Validate payload
    const parsed = TLStoreSchema.safeParse(nextStore);
    if (!parsed.success) {
      throw new BadRequestException('Invalid TLStore payload');
    }

    const current = await this.drawings.findOne({ where: { roomId } });
    if (!current) throw new NotFoundException('Room not found');

    const expectedPrev = nextVersion - 1;
    if (current.version !== expectedPrev) {
      throw new ConflictException(`Version conflict. current=${current.version}, incoming=${nextVersion}`);
    }

    const result = await this.drawings
      .createQueryBuilder()
      .update(Drawing)
      .set({ store: parsed.data as any, version: nextVersion })
      .where('room_id = :roomId AND version = :version', { roomId, version: expectedPrev })
      .returning('*')
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException('Concurrent update detected');
    }

    const row = result.raw[0] as Drawing;
    return row;
  }

  // Apply patch: put/update/delete against current store
  async applyPatch(
    roomId: string,
    baseVersion: number,
    changes: {
      put?: Record<string, any>[];
      update?: { id: string; after: Record<string, any> }[];
      remove?: { id: string }[];
    },
  ): Promise<Drawing> {
    const current = await this.drawings.findOne({ where: { roomId } });
    if (!current) throw new NotFoundException('Room not found');
    if (current.version !== baseVersion) {
      throw new ConflictException(`Version conflict. current=${current.version}, base=${baseVersion}`);
    }

    // Start from validated snapshot
    const curParsed = TLStoreSchema.parse(current.store ?? {});
    const next = { ...curParsed, records: { ...curParsed.records } } as TLStore;

    // put
    for (const rec of changes.put ?? []) {
      const val = TLRecordSchema.safeParse(rec);
      if (!val.success) throw new BadRequestException('Invalid record in put');
      next.records![val.data.id] = val.data;
    }
    // update (replace by id with provided fields)
    for (const upd of changes.update ?? []) {
      if (!upd?.id || typeof upd.after !== 'object') throw new BadRequestException('Invalid update entry');
      const merged = { ...(next.records?.[upd.id] ?? {}), ...upd.after };
      const val = TLRecordSchema.safeParse(merged);
      if (!val.success) throw new BadRequestException('Invalid record in update');
      next.records![upd.id] = val.data;
    }
    // remove
    for (const rem of changes.remove ?? []) {
      if (!rem?.id) throw new BadRequestException('Invalid remove entry');
      if (next.records) delete next.records[rem.id];
    }

    const nextVersion = current.version + 1;
    const result = await this.drawings
      .createQueryBuilder()
      .update(Drawing)
      .set({ store: next as any, version: nextVersion })
      .where('room_id = :roomId AND version = :version', { roomId, version: baseVersion })
      .returning('*')
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException('Concurrent update detected');
    }

    return result.raw[0] as Drawing;
  }
}
