import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errors } from "./http.ts";

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Caminho canônico: {workspace_id}/{brand_id}/{resource_type}/{uuid}.{ext} */
export function buildPath(
  workspaceId: string,
  brandId: string,
  resourceType: string,
  mimeType: string,
): string {
  const extension = EXTENSION[mimeType] ?? "png";
  return `${workspaceId}/${brandId}/${resourceType}/${crypto.randomUUID()}.${extension}`;
}

/** Guarda bytes já baixados (logo importado do site da marca). */
export async function uploadBytes(
  admin: SupabaseClient,
  params: {
    bucket: string;
    workspaceId: string;
    brandId: string;
    resourceType: string;
    bytes: Uint8Array;
    mimeType: string;
  },
): Promise<string | null> {
  const extensoes: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  const extension = extensoes[params.mimeType];
  if (!extension) return null;

  const path = `${params.workspaceId}/${params.brandId}/${params.resourceType}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage.from(params.bucket).upload(path, params.bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  return error ? null : path;
}

export async function uploadImage(
  admin: SupabaseClient,
  params: {
    bucket: string;
    workspaceId: string;
    brandId: string;
    resourceType: string;
    base64: string;
    mimeType: string;
  },
): Promise<string> {
  if (!EXTENSION[params.mimeType]) {
    throw errors.invalid("Formato de imagem não suportado.");
  }
  const path = buildPath(params.workspaceId, params.brandId, params.resourceType, params.mimeType);
  const bytes = decodeBase64(params.base64);

  const { error } = await admin.storage.from(params.bucket).upload(path, bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (error) throw errors.internal("Não foi possível salvar a imagem gerada.");

  return path;
}
