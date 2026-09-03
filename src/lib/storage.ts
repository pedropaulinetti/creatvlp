import { requireSupabase } from "@/lib/supabase";

/** Arquivos são privados: o acesso sempre passa por URL assinada e temporária. */
export async function signedUrl(bucket: string, path: string | null, expiresInSeconds = 3600) {
  if (!path) return null;
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function signedUrls(bucket: string, paths: string[], expiresInSeconds = 3600) {
  const client = requireSupabase();
  const clean = paths.filter(Boolean);
  if (!clean.length) return new Map<string, string>();

  const { data, error } = await client.storage.from(bucket).createSignedUrls(clean, expiresInSeconds);
  if (error || !data) return new Map<string, string>();

  const map = new Map<string, string>();
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

export type UploadValidation = { ok: true } | { ok: false; reason: string };

export function validateImageFile(file: File, { allowSvg = true, maxBytes = MAX_BYTES } = {}): UploadValidation {
  const allowed = allowSvg ? IMAGE_MIME : IMAGE_MIME.filter((mime) => mime !== "image/svg+xml");
  if (!allowed.includes(file.type)) {
    return { ok: false, reason: "Formato não aceito. Envie PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > maxBytes) {
    return { ok: false, reason: `Arquivo grande demais. O limite é ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }
  return { ok: true };
}

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/** Caminho canônico: {workspace_id}/{brand_id}/{resource_type}/{uuid}.{ext} */
export async function uploadBrandFile(params: {
  bucket: string;
  workspaceId: string;
  brandId: string;
  resourceType: string;
  file: File;
}): Promise<string> {
  const client = requireSupabase();
  const validation = validateImageFile(params.file);
  if (!validation.ok) throw new Error(validation.reason);

  const extension = EXTENSION[params.file.type] ?? "bin";
  const path = `${params.workspaceId}/${params.brandId}/${params.resourceType}/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage.from(params.bucket).upload(path, params.file, {
    contentType: params.file.type,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar o arquivo. Tente novamente.");

  return path;
}

export async function uploadBlob(params: {
  bucket: string;
  workspaceId: string;
  brandId: string;
  resourceType: string;
  blob: Blob;
  extension?: string;
}): Promise<string> {
  const client = requireSupabase();
  const extension = params.extension ?? "png";
  const path = `${params.workspaceId}/${params.brandId}/${params.resourceType}/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage.from(params.bucket).upload(path, params.blob, {
    contentType: params.blob.type || "image/png",
    upsert: true,
  });
  if (error) throw new Error("Não foi possível salvar o arquivo.");
  return path;
}
