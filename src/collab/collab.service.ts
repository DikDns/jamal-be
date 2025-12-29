import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drawing } from './drawing.entity';
import { z } from 'zod';
import { createTLSchema } from '@tldraw/tlschema';
import { Store } from '@tldraw/store';

// Changed from 'export type' to 'interface' for Jest compatibility
interface TLStore {
  schemaVersion?: number;
  records?: Record<string, any>;
}

// Export for use in gateway
export type { TLStore };

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
  ) { }

  // TLSchema + Store for full validation
  private readonly tlschema = createTLSchema();
  // Minimal TLStoreProps required by Store constructor — asset functions stubbed for validation only
  private readonly storeProps: any = {
    defaultName: 'Untitled',
    assets: {
      upload: async () => ({ src: '' }),
      resolve: async () => '',
      remove: async () => { },
    },
    onMount: () => { },
    collaboration: { status: null },
  };

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
    // Validate payload using Zod schema (fast, doesn't hang)
    const parsed = TLStoreSchema.safeParse(nextStore);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid TLStore payload: ${parsed.error.message}`);
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
      .set({ store: nextStore as any, version: nextVersion })
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

    // Apply patch using simple object manipulation (no TLSchema to avoid hanging)
    try {
      // Clone current store records
      const records = { ...(current.store?.records || {}) };

      // Apply puts - add new records
      if (changes.put && changes.put.length > 0) {
        for (const record of changes.put) {
          if (!record.id) throw new BadRequestException('Put record must have id');
          records[record.id] = record;
        }
      }

      // Apply updates - merge with existing records
      for (const upd of changes.update ?? []) {
        if (!upd?.id || typeof upd.after !== 'object') {
          throw new BadRequestException('Invalid update entry');
        }
        const existing = records[upd.id] || {};
        records[upd.id] = { ...existing, ...upd.after };
      }

      // Apply removes - delete records
      if (changes.remove && changes.remove.length > 0) {
        for (const rem of changes.remove) {
          delete records[rem.id];
        }
      }

      // Build new store
      const nextStore: TLStore = {
        schemaVersion: current.store?.schemaVersion || 1,
        records,
      };

      const nextVersion = current.version + 1;

      const result = await this.drawings
        .createQueryBuilder()
        .update(Drawing)
        .set({ store: nextStore as any, version: nextVersion })
        .where('room_id = :roomId AND version = :version', { roomId, version: baseVersion })
        .returning('*')
        .execute();

      if (result.affected !== 1) {
        throw new ConflictException('Concurrent update detected');
      }

      return result.raw[0] as Drawing;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof ConflictException) throw err;
      throw new BadRequestException(`Invalid patch or records: ${err?.message ?? err}`);
    }
  }
}
