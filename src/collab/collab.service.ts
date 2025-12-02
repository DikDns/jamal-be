import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drawing } from './drawing.entity';
import { z } from 'zod';
import { createTLSchema } from '@tldraw/tlschema';
import { Store } from '@tldraw/store';

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

  // TLSchema + Store for full validation
  private readonly tlschema = createTLSchema();
  // Minimal TLStoreProps required by Store constructor — asset functions stubbed for validation only
  private readonly storeProps: any = {
    defaultName: 'Untitled',
    assets: {
      upload: async () => ({ src: '' }),
      resolve: async () => '',
      remove: async () => {},
    },
    onMount: () => {},
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
    // Validate payload using official TLSchema/Store
    try {
      // create Store instance for validation; supply minimal props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = new Store({ schema: this.tlschema as any, props: this.storeProps as any } as any);
      // loadStoreSnapshot will validate records according to TLSchema
      // Accept either serialized store or snapshot shapes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (store as any).loadStoreSnapshot(nextStore as any);
      // If no error thrown, snapshot is valid
    } catch (err) {
      throw new BadRequestException(`Invalid TLStore payload: ${err?.message ?? err}`);
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

    // Apply patch using TLSchema-backed Store to validate
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = new Store({ schema: this.tlschema as any, props: this.storeProps as any } as any);
      // load current snapshot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (store as any).loadStoreSnapshot(current.store as any);

      // apply puts
      if (changes.put && changes.put.length > 0) {
        // store.put will validate records
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (store as any).put(changes.put as any[]);
      }

      // apply updates
      for (const upd of changes.update ?? []) {
        if (!upd?.id || typeof upd.after !== 'object') throw new BadRequestException('Invalid update entry');
        const existing = (store as any).get(upd.id);
        const merged = { ...(existing ?? {}), ...upd.after };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (store as any).put([merged as any]);
      }

      // apply removes
      if (changes.remove && changes.remove.length > 0) {
        const ids = changes.remove.map((r) => r.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (store as any).remove(ids as any[]);
      }

      // get snapshot after changes and persist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshot = (store as any).getStoreSnapshot();
      const nextVersion = current.version + 1;

      const result = await this.drawings
        .createQueryBuilder()
        .update(Drawing)
        .set({ store: snapshot as any, version: nextVersion })
        .where('room_id = :roomId AND version = :version', { roomId, version: baseVersion })
        .returning('*')
        .execute();

      if (result.affected !== 1) {
        throw new ConflictException('Concurrent update detected');
      }

      return result.raw[0] as Drawing;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Invalid patch or records: ${err?.message ?? err}`);
    }
  }
}
