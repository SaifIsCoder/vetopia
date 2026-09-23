# Cloud Storage Architecture — Vetopia Mobile MVP

This document specifies the storage infrastructure, bucket policies, client-side compression, and upload workflows for media and documents in the **Vetopia Mobile MVP**.

---

## 1. Storage Buckets & Access Matrix

| Bucket Identifier | Visibility | Max File Size | Permitted MIME Types | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `user-media` | Public (CDN Cached) | 5 MB | `image/jpeg`, `image/png`, `image/webp` | User avatars, pet photos, consultation attachments |
| `verification-docs` | Private (Encrypted) | 10 MB | `application/pdf`, `image/jpeg`, `image/png` | Vet medical licenses, clinic documents, e-prescriptions |

---

## 2. Directory Hierarchy & Naming Conventions

```text
user-media/
├── avatars/{userId}/avatar-{timestamp}.webp
└── pets/{ownerId}/{petId}/photo-{timestamp}.webp

verification-docs/
├── vet-licenses/{userId}/license-{timestamp}.pdf
└── prescriptions/{appointmentId}/prescription-{scriptId}.pdf
```

---

## 3. Client-Side Image Pre-Processing & Compression

To reduce cellular bandwidth and optimize upload latency on mobile networks, images captured via `expo-image-picker` must be compressed before transmission:

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

export async function compressPetPhoto(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }], // Max boundary for high-DPI phone screens
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
```

---

## 4. Secure Upload Protocol via Signed URLs

1. Mobile client requests a pre-signed upload URL from the Express backend:
   `POST /api/v1/storage/upload-url { bucket: 'verification-docs', filename: 'license.pdf' }`
2. Express validates user identity and returns a single-use signed upload URL.
3. Mobile client uploads binary directly to Supabase Storage via standard HTTP `PUT`.
4. This ensures backend application servers are not bottlenecked by file streaming.
