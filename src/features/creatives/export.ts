import { toBlob } from "html-to-image";
import JSZip from "jszip";

/** Exporta o nó em tamanho real. O que está na tela é o que sai no PNG. */
export async function renderToBlob(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio: 1,
    cacheBust: true,
    // O transform de escala é só para a tela; a exportação usa o tamanho real.
    style: { transform: "none", transformOrigin: "top left" },
    width: node.offsetWidth,
    height: node.offsetHeight,
  });
  if (!blob) throw new Error("Não foi possível gerar o PNG.");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadNode(node: HTMLElement, filename: string) {
  downloadBlob(await renderToBlob(node), filename);
}

export function safeFilename(value: string, fallback = "criativo"): string {
  const clean = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return clean.slice(0, 60) || fallback;
}

/** Exporta um lote como ZIP, com a composição em JSON junto de cada peça. */
export async function exportZip(
  items: { name: string; blob?: Blob; url?: string; composition?: unknown }[],
  zipName: string,
) {
  const zip = new JSZip();

  for (const item of items) {
    if (item.blob) {
      zip.file(`${item.name}.png`, item.blob);
    } else if (item.url) {
      const response = await fetch(item.url);
      if (response.ok) zip.file(`${item.name}.png`, await response.blob());
    }
    if (item.composition) {
      zip.file(`${item.name}.json`, JSON.stringify(item.composition, null, 2));
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, `${safeFilename(zipName, "creatvos-lote")}.zip`);
}
