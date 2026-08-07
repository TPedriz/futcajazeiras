import { toPng } from "html-to-image";

/**
 * Exporta um elemento (a cartinha) como PNG em alta resolução.
 * Usa `html-to-image`, com fallback para navegadores antigos via canvas.
 */
export async function cartinhaParaPng(
  node: HTMLElement,
  nomeArquivo = "cartinha.png",
): Promise<Blob | null> {
  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#0b0b0d",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    return null;
  }
}

/** Dispara o download do PNG da cartinha. */
export async function baixarCartinha(node: HTMLElement, nomeArquivo = "cartinha.png") {
  const blob = await cartinhaParaPng(node, nomeArquivo);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/** Compartilha o PNG via Web Share API (WhatsApp/Instagram no celular). */
export async function compartilharCartinha(
  node: HTMLElement,
  titulo = "Minha cartinha — Fut Cajazeiras",
) {
  const blob = await cartinhaParaPng(node, "cartinha.png");
  if (!blob) return false;
  const arquivo = new File([blob], "cartinha.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [arquivo] })) {
    await navigator.share({ files: [arquivo], title: titulo, text: titulo });
    return true;
  }
  return baixarCartinha(node);
}
