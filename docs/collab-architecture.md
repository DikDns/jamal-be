# Kolaborasi Realtime Whiteboard (TLDraw) — Desain Teknis

Dokumen ini mendeskripsikan arsitektur kolaborasi realtime berbasis NestJS + Socket.IO, penyimpanan TLDraw Store pada Neon Postgres, serta kontrak payload dan strategi konsistensi.

## 1. Ringkasan

- Tujuan: mendukung kolaborasi multi-user untuk kanvas whiteboard berbasis model data TLDraw (TLStore/TLRecord).
- Komponen utama:
  - Gateway WebSocket (Socket.IO, namespace `/collab`) untuk sinkronisasi realtime.
  - Service kolaborasi sebagai orchestrator persistence dan concurrency control.
  - Postgres (Neon) sebagai storage persisten dengan skema `drawings`.
- Pattern sinkronisasi: snapshot penuh (MVP) dengan opsi patch delta di iterasi berikutnya.

## 2. Data Model

### 2.1 Tabel `drawings`

- id: uuid (PK)
- room_id: text UNIQUE — identitas ruang/kanvas
- name: text NULL — nama tampilan ruang
- store: jsonb — snapshot TLStore (minimal: `{ schemaVersion, records }`)
- version: integer — counter untuk optimistic concurrency
- created_at, updated_at: timestamptz

Rasional:

- `jsonb` menyederhanakan penyimpanan TLStore yang beraneka tipe record (shape/page/asset/binding/…)
- `version` memungkinkan validasi urutan update antar klien.

### 2.2 TLStore (persisted)

- schemaVersion: number
- records: { [recordId: string]: TLRecord }
- Catatan: presence (cursor/camera/selection per user) tidak dipersist; bersifat ephemeral.

Referensi TLDraw: TLRecord, TLStore, TLStoreProps — server menyimpan snapshot/patch yang valid terhadap schema.

## 3. Kontrak WebSocket

Namespace: `/collab`

Events (client -> server):

- `join` { roomId: string }
- `store:get` { roomId: string }
- `store:set` { roomId: string, store: TLStore, version: number }
  - Aturan: `version` harus `currentVersion + 1` (optimistic concurrency)
- `store:patch` { roomId: string, baseVersion: number, changes: { put?: TLRecord[], update?: { id, after }[], remove?: { id }[] } }
  - Lebih efisien: hanya kirim delta. Server merge dan bump version.

Events (server -> client):

- `connected` { ok: true }
- `store:state` { roomId, store, version } — snapshot saat join / get
- `store:updated` { roomId, store, version } — broadcast setelah update sukses

Error policy:

- Kesalahan dikirim via event `error` { code, message }.
  - `UNAUTHENTICATED` — API key salah
  - `PAYLOAD_TOO_LARGE` — payload melebihi limit (set: set=~2MB, patch=~1MB)
  - `VERSION_CONFLICT` — versi tidak cocok, lakukan re-sync
  - `INVALID_PAYLOAD` — format/payload tidak valid
  - `NOT_FOUND` — room tidak ditemukan
  - `INTERNAL_ERROR` — error tidak terklasifikasi

## 4. Alur Utama

1. Client connect -> `join(roomId)` -> server join socket ke room + kirim `store:state` (snapshot & version).
2. Client edit -> hitung `nextStore`, `nextVersion = currentVersion + 1` -> `store:set`.
3. Server validasi versi dan persist -> broadcast `store:updated` ke seluruh member room.

## 5. Konsistensi & Konflik

- Mekanisme: Optimistic Concurrency via `version` integer.
- Jika konflik (versi tidak berurutan): tolak update dan minta klien re-sync snapshot lalu kirim ulang perubahan.
- Iterasi lanjut: patch-level merge (field-wise or last-writer-wins) dapat ditambahkan untuk mengurangi konflik.

## 6. Keamanan

- Auth: WebSocket handshake menggunakan API key `COLLAB_API_KEY` (Socket.IO auth atau query string).
- CORS: batasi origin di production.
- Payload limits: `store:set` ~2MB, `store:patch` ~1MB.
- Validation: server memvalidasi minimal schema TLStore/TLRecord (id, typeName) sebelum persist.

## 7. Panduan FE (contoh Socket.IO)

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/collab', {
  auth: { apiKey: process.env.NEXT_PUBLIC_COLLAB_API_KEY },
});

socket.on('connected', () => console.log('connected'));
socket.on('error', (e) => console.warn('ws error', e));
socket.on('store:state', (s) => console.log('state', s));
socket.on('store:updated', (s) => console.log('updated', s));

socket.emit('join', { roomId: 'room_123' });

// Snapshot update
socket.emit('store:set', { roomId: 'room_123', version: 2, store: nextStore });

// Patch update (disarankan)
socket.emit('store:patch', {
  roomId: 'room_123',
  baseVersion: 2,
  changes: {
    put: [
      {
        id: 'shape:new1',
        typeName: 'shape',
        type: 'geo',
        props: { geo: 'ellipse', w: 80, h: 50 },
      },
    ],
    update: [{ id: 'shape:rect_1', after: { props: { w: 120 } } }],
    remove: [{ id: 'shape:old' }],
  },
});
```

## 8. Skalabilitas

- Socket horizontal scaling: gunakan adapter Redis untuk Socket.IO (pub/sub) agar broadcast antar instance.
- DB: index `(room_id)`, materialisasi tambahan (mis. (room_id, updated_at)) bila diperlukan.
- Snapshot vs Patch: beralih ke patch delta untuk mengurangi bandwidth pada room aktif.

## 9. Observability

- Logging event penting (join, set) beserta ukuran payload.
- Metric: jumlah user per room, frekuensi update, rata-rata ukuran store, konflik versi.

## 10. Testing

- Unit test: service `setStore`, `getOrCreate`.
- E2E: dua klien melakukan join pada room sama, update berurutan -> keduanya menerima `store:updated` dengan versi yang meningkat.
- Negative: kirim `store:set` dengan `version` yang salah -> server menolak.

## 11. Payload & Schema (contoh)

### 10.1 Snapshot TLStore (DB jsonb)

```json
{
  "schemaVersion": 1,
  "records": {
    "shape:rect_1": {
      "id": "rect_1",
      "typeName": "shape",
      "type": "geo",
      "props": { "geo": "rectangle", "w": 100, "h": 60 }
    },
    "page:page1": {
      "id": "page1",
      "typeName": "page",
      "name": "Page 1"
    }
  }
}
```

### 10.2 store:set (Client -> Server)

```json
{
  "roomId": "room_123",
  "version": 2,
  "store": {
    "schemaVersion": 1,
    "records": {
      /* TLRecords */
    }
  }
}
```

### 10.3 store:updated (Server -> Clients)

```json
{
  "roomId": "room_123",
  "version": 2,
  "store": {
    "schemaVersion": 1,
    "records": {
      /* TLRecords */
    }
  }
}
```

## 12. Roadmap Lanjutan

- Event `store:patch` dengan payload delta:

```json
{
  "roomId": "room_123",
  "baseVersion": 2,
  "changes": {
    "put": [
      {
        /* TLRecord baru */
      }
    ],
    "update": [
      {
        "id": "shape:1",
        "after": {
          /* fields */
        }
      }
    ],
    "remove": [{ "id": "shape:2" }]
  }
}
```

- Validasi schema TLRecord di server (tlschema/zod) sebelum persist.
- Presence channel terpisah (cursor/camera) tanpa persist (Redis/memory only).
- Retensi & backup: snapshot harian per room (opsional).

## 13. Runbook

- Config env: `DATABASE_URL` Neon Postgres (SSL required).
- Start dev: `npm run start:dev` di folder `jamal-be`.
- Uji WS: connect ke `ws://localhost:3000/collab`, `join`, `store:get`, `store:set`.
- Recover konflik: kirim `store:get` untuk sync, hitung ulang perubahan, kirim `store:set` dengan versi benar.
