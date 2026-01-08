# 📘 Dokumentasi API AI Service untuk Frontend Developer

Dokumentasi ini menjelaskan cara mengintegrasikan fitur AI Service dari backend ke aplikasi frontend.

---

## 🔗 Base URL

```
/api/ai-service
```

> **Catatan:** Base URL bisa berbeda tergantung konfigurasi backend. Default base URL untuk AI Service menggunakan environment variable `JAMAL_AI_SERVICE_URL`.

---

## 📋 Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/ai-service/health` | Cek status kesehatan AI Service |
| GET | `/ai-service/debug` | Mendapatkan informasi debug AI Service |
| POST | `/ai-service/similarity` | Mengecek kemiripan antara dua teks |
| POST | `/ai-service/group` | Mengelompokkan ide-ide berdasarkan kemiripan |

---

## 1️⃣ Health Check

Mengecek apakah AI Service berjalan dengan baik.

### Request

```http
GET /ai-service/health
```

### Response

```typescript
interface HealthResponse {
  status: string;           // Status AI service (contoh: "healthy")
  model_loaded: boolean;    // Apakah model AI sudah dimuat
  model_loading: boolean;   // Apakah model sedang dalam proses loading
  tokenizer_loaded: boolean; // Apakah tokenizer sudah dimuat
  error?: string | null;    // Pesan error jika ada
}
```

### Contoh Response

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_loading": false,
  "tokenizer_loaded": true,
  "error": null
}
```

### Contoh Penggunaan (React/TypeScript)

```typescript
const checkHealth = async () => {
  try {
    const response = await fetch('/api/ai-service/health');
    const data: HealthResponse = await response.json();
    
    if (data.model_loaded && data.tokenizer_loaded) {
      console.log('AI Service siap digunakan!');
    } else if (data.model_loading) {
      console.log('Model sedang loading, mohon tunggu...');
    }
  } catch (error) {
    console.error('Gagal menghubungi AI Service:', error);
  }
};
```

---

## 2️⃣ Debug Info

Mendapatkan informasi detail untuk debugging AI Service.

### Request

```http
GET /ai-service/debug
```

### Response

```typescript
interface DebugResponse {
  cwd: string;              // Current working directory
  model_path: string;       // Path ke model AI
  model_exists: boolean;    // Apakah file model ada
  model_contents: string[]; // Isi direktori model
  tokenizer_exists: boolean; // Apakah tokenizer ada
  model_loaded: boolean;    // Apakah model sudah dimuat
  tokenizer_loaded: boolean; // Apakah tokenizer sudah dimuat
  error: string | null;     // Pesan error jika ada
  tf_version: string;       // Versi TensorFlow yang digunakan
}
```

> **Catatan:** Endpoint ini biasanya hanya digunakan untuk debugging dan sebaiknya tidak diekspos ke production.

---

## 3️⃣ Similarity Check ⭐

Mengecek kemiripan (similarity) antara dua teks menggunakan AI.

### Request

```http
POST /ai-service/similarity
Content-Type: application/json
```

### Request Body

```typescript
interface SimilarityRequest {
  text1: string;      // Teks pertama yang akan dibandingkan
  text2: string;      // Teks kedua yang akan dibandingkan
  threshold?: number; // Opsional: threshold kemiripan (default dari server)
}
```

### Response

```typescript
interface SimilarityResponse {
  distance: number;       // Jarak antara dua teks (semakin kecil = semakin mirip)
  is_similar: boolean;    // Apakah kedua teks dianggap mirip berdasarkan threshold
  threshold_used: number; // Threshold yang digunakan untuk penentuan
}
```

### Contoh Request

```json
{
  "text1": "Saya suka makan nasi goreng",
  "text2": "Saya senang menyantap nasi goreng",
  "threshold": 0.5
}
```

### Contoh Response

```json
{
  "distance": 0.25,
  "is_similar": true,
  "threshold_used": 0.5
}
```

### Contoh Penggunaan (React/TypeScript)

```typescript
interface SimilarityRequest {
  text1: string;
  text2: string;
  threshold?: number;
}

interface SimilarityResponse {
  distance: number;
  is_similar: boolean;
  threshold_used: number;
}

const checkSimilarity = async (
  text1: string, 
  text2: string, 
  threshold?: number
): Promise<SimilarityResponse> => {
  const response = await fetch('/api/ai-service/similarity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text1,
      text2,
      threshold,
    } as SimilarityRequest),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Penggunaan
const result = await checkSimilarity(
  "Implementasi fitur login dengan OAuth",
  "Membuat sistem autentikasi menggunakan OAuth",
  0.6
);

if (result.is_similar) {
  console.log(`Kedua teks mirip dengan jarak: ${result.distance}`);
}
```

---

## 4️⃣ Group Ideas ⭐

Mengelompokkan berbagai ide/teks berdasarkan kemiripan semantik.

### Request

```http
POST /ai-service/group
Content-Type: application/json
```

### Request Body

```typescript
interface GroupRequest {
  ideas: string[];     // Array berisi ide-ide yang akan dikelompokkan
  threshold?: number;  // Opsional: threshold untuk pengelompokan
}
```

### Response

```typescript
interface GroupResponse {
  groups: Record<string, string[]>; // Hasil pengelompokan (key = group id, value = array of ideas)
  n_groups: number;                  // Jumlah group yang terbentuk
  threshold_used: number;            // Threshold yang digunakan
  distance_matrix: number[][];       // Matrix jarak antar ide
}
```

### Contoh Request

```json
{
  "ideas": [
    "Membuat sistem login",
    "Implementasi autentikasi pengguna",
    "Desain tampilan dashboard",
    "Membuat halaman admin",
    "Fitur registrasi user"
  ],
  "threshold": 0.5
}
```

### Contoh Response

```json
{
  "groups": {
    "0": ["Membuat sistem login", "Implementasi autentikasi pengguna", "Fitur registrasi user"],
    "1": ["Desain tampilan dashboard", "Membuat halaman admin"]
  },
  "n_groups": 2,
  "threshold_used": 0.5,
  "distance_matrix": [
    [0.0, 0.2, 0.8, 0.7, 0.3],
    [0.2, 0.0, 0.7, 0.6, 0.25],
    [0.8, 0.7, 0.0, 0.3, 0.75],
    [0.7, 0.6, 0.3, 0.0, 0.65],
    [0.3, 0.25, 0.75, 0.65, 0.0]
  ]
}
```

### Contoh Penggunaan (React/TypeScript)

```typescript
interface GroupRequest {
  ideas: string[];
  threshold?: number;
}

interface GroupResponse {
  groups: Record<string, string[]>;
  n_groups: number;
  threshold_used: number;
  distance_matrix: number[][];
}

const groupIdeas = async (
  ideas: string[], 
  threshold?: number
): Promise<GroupResponse> => {
  const response = await fetch('/api/ai-service/group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ideas,
      threshold,
    } as GroupRequest),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Penggunaan
const ideasList = [
  "Membuat fitur upload file",
  "Implementasi file storage",
  "Dashboard analytics",
  "Grafik statistik penjualan"
];

const result = await groupIdeas(ideasList, 0.5);

console.log(`Terbentuk ${result.n_groups} kelompok:`);
Object.entries(result.groups).forEach(([groupId, ideas]) => {
  console.log(`Group ${groupId}:`, ideas);
});
```

---

## 🎯 Rekomendasi Penggunaan dengan React Query

Berikut adalah contoh implementasi menggunakan React Query untuk pengelolaan state yang lebih baik:

```typescript
// hooks/useAiService.ts
import { useMutation, useQuery } from '@tanstack/react-query';

// Types
interface SimilarityRequest {
  text1: string;
  text2: string;
  threshold?: number;
}

interface SimilarityResponse {
  distance: number;
  is_similar: boolean;
  threshold_used: number;
}

interface GroupRequest {
  ideas: string[];
  threshold?: number;
}

interface GroupResponse {
  groups: Record<string, string[]>;
  n_groups: number;
  threshold_used: number;
  distance_matrix: number[][];
}

interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_loading: boolean;
  tokenizer_loaded: boolean;
  error?: string | null;
}

// API functions
const aiServiceApi = {
  getHealth: async (): Promise<HealthResponse> => {
    const res = await fetch('/api/ai-service/health');
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },
  
  checkSimilarity: async (data: SimilarityRequest): Promise<SimilarityResponse> => {
    const res = await fetch('/api/ai-service/similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to check similarity');
    return res.json();
  },
  
  groupIdeas: async (data: GroupRequest): Promise<GroupResponse> => {
    const res = await fetch('/api/ai-service/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to group ideas');
    return res.json();
  },
};

// Hooks
export const useAiHealth = () => {
  return useQuery({
    queryKey: ['ai-service', 'health'],
    queryFn: aiServiceApi.getHealth,
    refetchInterval: 30000, // Refresh setiap 30 detik
  });
};

export const useSimilarityCheck = () => {
  return useMutation({
    mutationFn: aiServiceApi.checkSimilarity,
  });
};

export const useGroupIdeas = () => {
  return useMutation({
    mutationFn: aiServiceApi.groupIdeas,
  });
};
```

### Contoh Penggunaan di Component

```tsx
// components/SimilarityChecker.tsx
import { useState } from 'react';
import { useSimilarityCheck, useAiHealth } from '../hooks/useAiService';

export function SimilarityChecker() {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  
  const { data: health, isLoading: healthLoading } = useAiHealth();
  const similarityMutation = useSimilarityCheck();

  const handleCheck = () => {
    similarityMutation.mutate(
      { text1, text2, threshold: 0.5 },
      {
        onSuccess: (data) => {
          console.log('Similarity result:', data);
        },
        onError: (error) => {
          console.error('Error:', error);
        },
      }
    );
  };

  if (healthLoading) return <div>Checking AI Service...</div>;
  
  if (!health?.model_loaded) {
    return <div>AI Model belum siap. Mohon tunggu...</div>;
  }

  return (
    <div>
      <textarea 
        value={text1} 
        onChange={(e) => setText1(e.target.value)} 
        placeholder="Teks pertama"
      />
      <textarea 
        value={text2} 
        onChange={(e) => setText2(e.target.value)} 
        placeholder="Teks kedua"
      />
      
      <button 
        onClick={handleCheck} 
        disabled={similarityMutation.isPending}
      >
        {similarityMutation.isPending ? 'Mengecek...' : 'Cek Kemiripan'}
      </button>
      
      {similarityMutation.data && (
        <div>
          <p>Jarak: {similarityMutation.data.distance.toFixed(4)}</p>
          <p>Mirip: {similarityMutation.data.is_similar ? 'Ya ✅' : 'Tidak ❌'}</p>
        </div>
      )}
    </div>
  );
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Status | Deskripsi |
|--------|-----------|
| 200 | Request berhasil |
| 400 | Bad Request - Format request tidak valid |
| 502 | Bad Gateway - AI Service gagal memproses |
| 503 | Service Unavailable - AI Service tidak dapat dihubungi |

### Contoh Error Handling

```typescript
const handleAiRequest = async () => {
  try {
    const result = await checkSimilarity(text1, text2);
    // Handle success
  } catch (error) {
    if (error.message.includes('502')) {
      // AI Service error
      showToast('AI Service sedang bermasalah, coba lagi nanti');
    } else if (error.message.includes('503')) {
      // Service unavailable
      showToast('AI Service tidak tersedia');
    } else {
      showToast('Terjadi kesalahan tidak diketahui');
    }
  }
};
```

---

## 📝 Catatan Penting

1. **Model Loading**: Saat pertama kali server dinyalakan, model AI memerlukan waktu untuk loading. Gunakan endpoint `/health` untuk mengecek status sebelum mengirim request.

2. **Threshold**: Parameter `threshold` menentukan seberapa "mirip" dua teks harus dianggap sama:
   - Nilai lebih kecil = lebih ketat (teks harus sangat mirip)
   - Nilai lebih besar = lebih longgar (teks yang agak mirip sudah dianggap sama)

3. **Performance**: Untuk request dengan banyak ide di endpoint `/group`, response time bisa lebih lama. Pertimbangkan untuk menambahkan loading state yang informatif.

4. **Rate Limiting**: Pertimbangkan untuk implementasi debouncing/throttling pada sisi frontend jika menggunakan fitur auto-check.

---

## 🔧 Environment Variables

Backend memerlukan environment variable berikut:

```env
JAMAL_AI_SERVICE_URL=https://dikdns-jamal-ai-service.hf.space
```

---

*Dokumentasi ini dibuat untuk membantu integrasi AI Service ke frontend. Jika ada pertanyaan, silakan hubungi tim backend.*
