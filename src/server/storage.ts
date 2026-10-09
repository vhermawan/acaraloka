import "server-only";

import { env } from "@/lib/env";

export const POSTER_BUCKET = "posters";
export const SIGNATURE_BUCKET = "signatures";
export const CERTIFICATE_BACKGROUND_BUCKET = "certificate-backgrounds";

function storageConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk upload berkas. Lihat .env.example.");
  }
  return { baseUrl: `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

export async function createSignedUploadUrl(bucket: string, path: string): Promise<string> {
  const { baseUrl, key } = storageConfig();
  const response = await fetch(`${baseUrl}/object/upload/sign/${bucket}/${path}`, {
    method: "POST",
    headers: authHeaders(key),
  });
  if (!response.ok) {
    throw new Error(`Gagal membuat signed upload URL (${response.status}): ${await response.text()}`);
  }
  const { url } = (await response.json()) as { url: string };
  return `${baseUrl}${url}`;
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { baseUrl, key } = storageConfig();
  await fetch(`${baseUrl}/object/${bucket}`, {
    method: "DELETE",
    headers: { ...authHeaders(key), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}

export function publicObjectUrl(bucket: string, path: string): string {
  const { baseUrl } = storageConfig();
  return `${baseUrl}/object/public/${bucket}/${path}`;
}

export async function uploadObject(bucket: string, path: string, body: Uint8Array, contentType: string): Promise<void> {
  const { baseUrl, key } = storageConfig();
  const response = await fetch(`${baseUrl}/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(key), "Content-Type": contentType },
    body: Buffer.from(body),
  });
  if (!response.ok) {
    throw new Error(`Gagal mengunggah berkas (${response.status}): ${await response.text()}`);
  }
}

export async function downloadObject(bucket: string, path: string): Promise<Uint8Array> {
  const { baseUrl, key } = storageConfig();
  const response = await fetch(`${baseUrl}/object/${bucket}/${path}`, { headers: authHeaders(key), cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Gagal mengunduh berkas (${response.status}): ${await response.text()}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
