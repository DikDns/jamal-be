# Kolaborasi Realtime Whiteboard (FE Quick Guide)

Dokumen singkat ini menjelaskan apa yang perlu diketahui tim frontend untuk terhubung, menampilkan, dan mensinkronkan kanvas TLDraw secara realtime dengan backend (NestJS + Socket.IO). Fokus: koneksi, event contract, contoh payload, dan kapan memakai REST vs WebSocket.

## 1. Ringkasan singkat (untuk FE)

- Tujuan: FE dapat menampilkan dan berkolaborasi pada kanvas TLDraw yang disimpan server, dengan model snapshot + optional patch.
- Gunakan WebSocket (`/collab`) untuk realtime sync (join, get snapshot, set/patch updates).
- Gunakan REST `/drawings` untuk membuat/menyimpan/menemukan kanvas (fallback, browse, dan bootstrapping).

## 2. Data Model

### 2.1 Data yang disimpan (ringkas)

- `drawings` menyimpan snapshot TLStore per kanvas:
  - `id` (uuid) — primary key
  - `room_id` (text, unique) — string identifier yang FE gunakan untuk join (contoh: `room_123`). Note: server saat ini menerima `room_id` nullable to allow safe migrations/backfills; production idealnya `NOT NULL`.
  - `store` (jsonb) — TLStore snapshot: `{ schemaVersion, records }
  - `version` (integer) — optimistic concurrency counter (increment setiap sukses persist)

Rasional singkat untuk FE: server mengirim snapshot + version saat client join; setiap update harus menyertakan `version = current + 1` untuk accepted updates.

### 2.2 TLStore (persisted)

- schemaVersion: number
- records: { [recordId: string]: TLRecord }
- Catatan: presence (cursor/camera/selection per user) tidak dipersist; bersifat ephemeral.

Referensi TLDraw: TLRecord, TLStore, TLStoreProps — server menyimpan snapshot/patch yang valid terhadap schema.

## 3. WebSocket contract (FE-focused)

Namespace: `/collab`

Core events (client -> server):

- `join` { roomId: string }
  - Action: client asks to join a room. Server responds with `store:state` (current snapshot + version).

- `store:get` { roomId: string }
  - Action: request the latest snapshot for a room (useful for explicit re-sync).

- `store:set` { roomId: string, store: TLStore, version: number }
  - Use when sending a full snapshot. `version` must equal `currentVersion + 1` else server rejects with `VERSION_CONFLICT`.

- `store:patch` { roomId: string, baseVersion: number, changes }
  - Use when sending a delta (put/update/remove). `baseVersion` is the version the patch is based on; server will apply and bump version if valid.

Core events (server -> client):

- `store:state` { roomId, store, version } — initial snapshot returned after `join` or `store:get`.
- `store:updated` { roomId, store, version } — broadcast to room after a successful update/patch.
- `error` { code, message } — non-2xx responses for event operations.

Common error codes (FE handling):

- `UNAUTHENTICATED` — fail handshake (invalid API key). Client should stop trying and surface login.
- `VERSION_CONFLICT` — client should `store:get` to re-sync and re-apply local changes.
- `PAYLOAD_TOO_LARGE` — compress/convert to patch or show user an upload error.
- `NOT_FOUND` — room missing (show 404 / create new canvas flow).

Notes for FE implementer:

- Always on `join`: expect `store:state` as single source-of-truth and set local TLStore and version.
- Use optimistic updates in UI, but on server `VERSION_CONFLICT` re-sync and merge local edits.
- Prefer `store:patch` for frequent small edits; use `store:set` for save/checkpoint operations.

## 4. Typical FE flow (quick)

1. Connect socket:

```js
const socket = io('https://api.example.com/collab', { auth: { apiKey } });
socket.emit('join', { roomId: 'room_123' });
socket.on('store:state', s => {
  // set local TLStore and currentVersion = s.version
});
```

2. User edits:

- build a patch (or snapshot)
- for patch: `socket.emit('store:patch', { roomId, baseVersion, changes })`
- for snapshot: `socket.emit('store:set', { roomId, version: current + 1, store })`

3. On server success you will receive `store:updated` from server with the new snapshot + version.

4. On `VERSION_CONFLICT` -> call `store:get` or `join` to re-sync snapshot and re-apply local diffs.

## 5. Konsistensi & Konflik

- Mekanisme: Optimistic Concurrency via `version` integer.
- Jika konflik (versi tidak berurutan): tolak update dan minta klien re-sync snapshot lalu kirim ulang perubahan.
- Iterasi lanjut: patch-level merge (field-wise or last-writer-wins) dapat ditambahkan untuk mengurangi konflik.

## 5. Security & limits (for FE)

- Auth: pass API key in Socket.IO handshake via `auth: { apiKey }` (do not put secrets in client bundle; use short-lived tokens when possible).
- Payload size: keep snapshots small; prefer patching. Server may return `PAYLOAD_TOO_LARGE`.
- Validation: server validates TLStore shape minimally — always send well-formed TLRecords.

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


## 6. REST endpoints (when to use them)

- `GET /drawings` — list available drawings (FE: used for browser/explore pages)
- `POST /drawings` — create a new drawing (returns id)
- `GET /drawings/:id` — fetch a persisted snapshot (useful when bootstrapping without WS)
- `PUT /drawings/:id` — replace persisted snapshot
- `DELETE /drawings/:id` — delete canvas

FE guidance: create via REST or provide a UI to create new drawing; once created, open socket and `join` with the returned `id`.

## 9. Observability

- Logging event penting (join, set) beserta ukuran payload.
- Metric: jumlah user per room, frekuensi update, rata-rata ukuran store, konflik versi.

## 7. Scripts & quick commands (dev)

There are small dev scripts in the project root for local/dev ops:

- `scripts/add_room_id_column.js` — safe migration helper that ensures `room_id` column exists and creates an index. Run locally if your DB needs the column:

```bash
node -r dotenv/config scripts/add_room_id_column.js
```

- `scripts/ws_drawings_smoke.js` — connects to the running server, creates a temporary drawing, joins it and validates `drawing:patch` roundtrip (useful for quick smoke test):

```bash
node -r dotenv/config scripts/ws_drawings_smoke.js
```

Notes: these scripts read `DATABASE_URL` and other env vars via `.env`; do not commit secrets and keep them in CI secret store.

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


## 8. Runbook (quick)

- Set env: `DATABASE_URL` and `COLLAB_API_KEY` (for local dev handshake if required).
- Start server:

```bash
npm run start:dev
```

- FE quick debug flow:
  - Create a drawing via `POST /drawings` or use an existing id.
  - Connect socket to `/collab` and `join` that `roomId`.
  - Expect `store:state` then send `store:patch` or `store:set`.

If you hit `VERSION_CONFLICT`: call `store:get` and re-apply local diffs.

---

If you want, I can also:

- Standardize naming in code/docs (prefer `store:*` events under `/collab`) and remove or document `DrawingsGateway` names (`joinDrawing`, `drawing:update`) to avoid confusion for FE; or
- Add a short `docs/collab-quick-start.md` that contains only the code snippets FE needs to copy.

Tell me if you want standardization (I can patch code + docs) or just keep both event names documented.

## 14. Referensi

- TLStore: https://tldraw.dev/reference/tlschema/TLStore
- TLRecord: https://tldraw.dev/reference/tlschema/TLRecord
- TLStoreProps: https://tldraw.dev/reference/tlschema/TLStoreProps
- NestJS WebSockets: https://docs.nestjs.com/websockets/gateways
- Socket.IO server/client: https://socket.io/docs/v4/
- TypeORM: https://typeorm.io
- Neon Postgres: https://neon.tech/docs/connect/connect-with-node
