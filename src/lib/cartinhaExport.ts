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

/**
 * Dispara o download do PNG da cartinha.
 * No celular, abre o "share sheet" (seleção de app) para enviar a imagem
 * direto para o WhatsApp/Instagram/etc.; em desktop (ou quando não há suporte)
 * baixa o arquivo normalmente.
 */
export async function baixarCartinha(node: HTMLElement, nomeArquivo = "cartinha.png") {
  const blob = await cartinhaParaPng(node, nomeArquivo);
  if (!blob) return false;

  // No celular: prioriza o Web Share API para o usuário escolher o app.
  const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nomeArquivo });
      return true;
    } catch {
      /* usuário cancelou: cai no download */
    }
  }

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
