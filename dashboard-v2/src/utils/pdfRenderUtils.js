import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Renderiza uma página de um Blob PDF (ex.: folha do Aspire desmembrada por chapa)
 * para uma imagem JPEG nítida em fundo branco para embutir direto na Ficha Técnica A4 ou em miniatura.
 */
export async function renderPdfBlobToImageDataUrl(blob, { maxWidth = 1400, pageNumber = 1 } = {}) {
  if (!blob) return null;
  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  try {
    const safePageNum = Math.min(Math.max(1, Number(pageNumber) || 1), pdf.numPages);
    const page = await pdf.getPage(safePageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = baseViewport.width > 0 ? Math.min(2.2, maxWidth / baseViewport.width) : 1;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // ignore cleanup error
    }
  }
}
