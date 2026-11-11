import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
export type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
export function openPDF(bytes: Uint8Array) {
  return pdfjs.getDocument({ data: bytes.slice(), cMapUrl: `${import.meta.env.BASE_URL}cmaps/`, cMapPacked: true, standardFontDataUrl: `${import.meta.env.BASE_URL}standard_fonts/`, wasmUrl: `${import.meta.env.BASE_URL}wasm/`, enableXfa: false }).promise
}
export function closePDF(document: pdfjs.PDFDocumentProxy | null) { document?.loadingTask.destroy().catch(() => {}) }
export function blobFromBytes(bytes: Uint8Array, type = 'application/pdf') { return new Blob([new Uint8Array(bytes).buffer], { type }) }
export function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }