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

/**
 * Extensão pelo tipo servido.
 *
 * Fonte entra aqui junto com imagem: a tabela só tinha tipo de imagem, então
 * todo arquivo de fonte baixado do site da marca morria neste mapa, antes do
 * upload, devolvendo `null` em silêncio. O nome da família chegava na tela
 * (vem do CSS, por outro caminho) e o arquivo nunca chegava.
 */
export const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "font/sfnt": "ttf",
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "application/x-font-ttf": "ttf",
  "application/x-font-truetype": "ttf",
  "application/x-font-opentype": "otf",
  "application/vnd.ms-fontobject": "eot",
};

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
    /**
     * Extensão vinda do endereço, para quando o servidor não diz o tipo.
     * Servidor de fonte manda `application/octet-stream` com frequência, e aí
     * só a URL sabe se é woff2 ou ttf.
     */
    extensao?: string;
  },
): Promise<string | null> {
  const extension = EXTENSAO_POR_TIPO[params.mimeType] ?? params.extensao;
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
