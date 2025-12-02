import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('drawings')
export class Drawing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'room_id', type: 'text', unique: true, nullable: true })
  roomId?: string;

  @Column({ type: 'text', nullable: true })
  name?: string;

  // TLStore JSON (schemaVersion + records dsb)
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  store!: Record<string, any>;

  // Optimistic concurrency counter
  @Column({ type: 'integer', default: 0 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
