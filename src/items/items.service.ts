import { Injectable, Inject, NotFoundException } from '@nestjs/common';

@Injectable()
export class ItemsService {
  constructor(@Inject('POSTGRES_POOL') private readonly sql: any) {}

  private validateId(id: number) {
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid id');
  }

  async create(payload: { name: string; description?: string }) {
    const res = await this.sql.query(
      'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
      [payload.name, payload.description ?? null],
    );
    return res.rows?.[0] ?? res[0];
  }

  async findAll() {
    const res = await this.sql.query('SELECT * FROM items');
    return res.rows ?? res;
  }

  async findOne(id: number) {
    this.validateId(id);
    const res = await this.sql.query('SELECT * FROM items WHERE id = $1', [id]);
    const row = res.rows?.[0] ?? res[0];
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }

  async update(id: number, payload: { name?: string; description?: string }) {
    this.validateId(id);
    const res = await this.sql.query(
      'UPDATE items SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [payload.name ?? null, payload.description ?? null, id],
    );
    const row = res.rows?.[0] ?? res[0];
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }

  async remove(id: number) {
    this.validateId(id);
    const res = await this.sql.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    const row = res.rows?.[0] ?? res[0];
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }
}
