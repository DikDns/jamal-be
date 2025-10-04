import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(@Inject('POSTGRES_POOL') private readonly sql: any) { }

  getHello(): string {
    return 'Hello World!';
  }

  private validateTableName(name: string) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      throw new Error('Invalid table name');
    }
  }

  async getTable(name: string): Promise<any[]> {
    this.validateTableName(name);
    // Use sql.query for conventional calls (per neon serverless driver guidance)
    const res = await this.sql.query(`SELECT * FROM ${name}`);
    return res.rows ?? res;
  }
}