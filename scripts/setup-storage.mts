import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}

const buckets = [
  {
    id: "posters",
    name: "posters",
    public: true,
    file_size_limit: 2 * 1024 * 1024,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
  },
  {
    id: "signatures",
    name: "signatures",
    public: false,
    file_size_limit: 300 * 1024,
    allowed_mime_types: ["image/png"],
  },
  {
    id: "certificate-backgrounds",
    name: "certificate-backgrounds",
    public: false,
    file_size_limit: 3 * 1024 * 1024,
    allowed_mime_types: ["image/jpeg", "image/png"],
  },
];

const headers = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };

for (const bucket of buckets) {
  const existing = await fetch(`${url}/storage/v1/bucket/${bucket.id}`, { headers });
  const response = existing.ok
    ? await fetch(`${url}/storage/v1/bucket/${bucket.id}`, { method: "PUT", headers, body: JSON.stringify(bucket) })
    : await fetch(`${url}/storage/v1/bucket`, { method: "POST", headers, body: JSON.stringify(bucket) });

  if (!response.ok) {
    console.error(`Gagal menyiapkan bucket ${bucket.id}: ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  console.log(`Bucket ${bucket.id} siap (${existing.ok ? "diperbarui" : "dibuat"}).`);
}
