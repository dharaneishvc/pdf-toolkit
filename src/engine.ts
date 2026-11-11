import { PDFDocument, StandardFonts, degrees, rgb, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFName } from 'pdf-lib'

export const pdfTools = [
  { id: 'merge', name: 'Merge PDFs', category: 'Organize' }, { id: 'split', name: 'Split to individual pages', category: 'Organize' },
  { id: 'extract', name: 'Extract pages', category: 'Organize' }, { id: 'delete', name: 'Delete pages', category: 'Organize' },
  { id: 'reorder', name: 'Reorder pages', category: 'Organize' }, { id: 'duplicate', name: 'Duplicate pages', category: 'Organize' },
  { id: 'rotate', name: 'Rotate pages', category: 'Page layout' }, { id: 'crop', name: 'Crop page view', category: 'Page layout' },
  { id: 'resize', name: 'Resize pages', category: 'Page layout' }, { id: 'blank', name: 'Insert blank page', category: 'Page layout' },
  { id: 'watermark', name: 'Text watermark', category: 'Compose' }, { id: 'numbers', name: 'Page numbers', category: 'Compose' },
  { id: 'text', name: 'Add text', category: 'Compose' }, { id: 'rectangle', name: 'Draw rectangle', category: 'Compose' },
  { id: 'image', name: 'Image overlay', category: 'Compose' }, { id: 'images-pdf', name: 'Images to PDF', category: 'Convert' },
  { id: 'render', name: 'PDF to images', category: 'Convert' }, { id: 'text-extract', name: 'Extract text', category: 'Convert' },
  { id: 'metadata', name: 'Edit document metadata', category: 'Document' }, { id: 'metadata-clear', name: 'Clear standard metadata', category: 'Document' },
  { id: 'inspect', name: 'Document inspector', category: 'Document' }, { id: 'flatten', name: 'Flatten form fields', category: 'Forms' },
  { id: 'fill', name: 'Fill form fields', category: 'Forms' }, { id: 'forms', name: 'Inspect form fields', category: 'Forms' },
  { id: 'attach', name: 'Add attachment', category: 'Attachments' }, { id: 'attachments', name: 'Extract attachments', category: 'Attachments' },
]
export type PDFOptions = { pages: string; rotation: number; text: string; fontSize: number; color: string; opacity: number; x: number; y: number; width: number; height: number; start: number; insertAt: number; title: string; author: string; subject: string; keywords: string; formValues: string; attachmentName: string }
export const defaults: PDFOptions = { pages: '', rotation: 90, text: 'DRAFT', fontSize: 36, color: '#555555', opacity: 35, x: 36, y: 36, width: 595, height: 842, start: 1, insertAt: 1, title: '', author: '', subject: '', keywords: '', formValues: '{}', attachmentName: 'attachment.bin' }
export function pageRange(input: string, count: number, allowDuplicates = false) {
  if (!Number.isInteger(count) || count < 1 || count > 300) throw new Error('A PDF must contain 1-300 pages.')
  if (!input.trim()) return Array.from({ length: count }, (_unused, index) => index)
  const result: number[] = []
  for (const piece of input.split(',')) {
    const match = piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('Use page numbers and ascending ranges, for example 1,3-5.')
    const first = Number(match[1]); const last = Number(match[2] ?? match[1])
    if (first < 1 || last > count || first > last) throw new Error(`Page ranges must be between 1 and ${count}.`)
    for (let page = first; page <= last; page++) result.push(page - 1)
    if (result.length > 600) throw new Error('Page selection is too large.')
  }
  return allowDuplicates ? result : [...new Set(result)]
}
export async function load(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 100_000_000) throw new Error('PDFs must be non-empty and under 100 MB.')
  let document: PDFDocument
  try { document = await PDFDocument.load(bytes, { updateMetadata: false }) } catch { throw new Error('Cannot open this PDF. Encrypted or corrupt documents are not supported.') }
  pageRange('', document.getPageCount())
  return document
}
function color(input: string) { if (!/^#[\da-f]{6}$/i.test(input)) throw new Error('Choose a six-digit hex color.'); return rgb(...[1, 3, 5].map(offset => Number.parseInt(input.slice(offset, offset + 2), 16) / 255) as [number, number, number]) }
function finite(value: number, minimum: number, maximum: number, label: string) { if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`); return value }
function noForms(document: PDFDocument) { if (document.getForm().getFields().length) throw new Error('Flatten form fields first. This page operation cannot reliably preserve editable forms.') }
async function copied(document: PDFDocument, indices: number[]) { noForms(document); if (indices.length > 300) throw new Error('Output exceeds 300 pages.'); const output = await PDFDocument.create(); const pages = await output.copyPages(document, indices); pages.forEach(page => output.addPage(page)); return output }
async function embed(document: PDFDocument, bytes: Uint8Array) { if (bytes[0] === 0x89 && bytes[1] === 0x50) return document.embedPng(bytes); if (bytes[0] === 0xff && bytes[1] === 0xd8) return document.embedJpg(bytes); throw new Error('Image input must be PNG or JPEG.') }
export async function inspect(bytes: Uint8Array) {
  const document = await load(bytes)
  return { pages: document.getPageCount(), title: document.getTitle() ?? '', author: document.getAuthor() ?? '', subject: document.getSubject() ?? '', keywords: document.getKeywords() ?? '', creator: document.getCreator() ?? '', producer: document.getProducer() ?? '', creationDate: document.getCreationDate()?.toISOString(), modificationDate: document.getModificationDate()?.toISOString(), pageSizes: document.getPages().map((page, index) => ({ page: index + 1, ...page.getSize(), rotation: page.getRotation().angle, cropBox: page.getCropBox() })), forms: document.getForm().getFields().map(field => ({ name: field.getName(), type: field.constructor.name, value: field instanceof PDFTextField ? field.getText() : field instanceof PDFCheckBox ? field.isChecked() : field instanceof PDFDropdown || field instanceof PDFOptionList ? field.getSelected() : field instanceof PDFRadioGroup ? field.getSelected() : null, options: field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup ? field.getOptions() : undefined })) }
}
export async function processPDF(inputs: Uint8Array[], operation: string, options: Partial<PDFOptions> = {}, extra?: Uint8Array) {
  const settings = { ...defaults, ...options }
  if (!pdfTools.some(tool => tool.id === operation)) throw new Error('Unknown PDF operation.')
  if (!inputs.length || inputs.length > 24 || inputs.reduce((total, bytes) => total + bytes.length, 0) > 100_000_000) throw new Error('Use 1-24 inputs totaling at most 100 MB.')
  if (operation === 'images-pdf') {
    const output = await PDFDocument.create()
    for (const bytes of inputs) { const image = await embed(output, bytes); if (image.width * image.height > 16_000_000) throw new Error('Image exceeds 16 megapixels.'); const width = finite(settings.width, 72, 14400, 'Page width'); const height = finite(settings.height, 72, 14400, 'Page height'); const page = output.addPage([width, height]); const scale = Math.min((width - 36) / image.width, (height - 36) / image.height); page.drawImage(image, { x: (width - image.width * scale) / 2, y: (height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale }) }
    return output.save()
  }
  let document = await load(inputs[0])
  const indices = pageRange(settings.pages, document.getPageCount(), operation === 'reorder' || operation === 'duplicate')
  if (operation === 'merge') {
    document = await PDFDocument.create()
    for (const bytes of inputs) { const source = await load(bytes); noForms(source); if (document.getPageCount() + source.getPageCount() > 300) throw new Error('Merged PDF exceeds 300 pages.'); const pages = await document.copyPages(source, source.getPageIndices()); pages.forEach(page => document.addPage(page)) }
  } else if (operation === 'extract' || operation === 'reorder') document = await copied(document, indices)
  else if (operation === 'duplicate') { noForms(document); if (document.getPageCount() + indices.length > 300) throw new Error('Output exceeds 300 pages.'); const pages = await document.copyPages(document, indices); pages.forEach(page => document.addPage(page)) }
  else if (operation === 'delete') { noForms(document); if (indices.length === document.getPageCount()) throw new Error('Cannot delete every page.'); [...indices].sort((first, second) => second - first).forEach(index => document.removePage(index)) }
  else if (operation === 'rotate') { if (![0, 90, 180, 270].includes(settings.rotation)) throw new Error('Rotation must be a multiple of 90 degrees.'); for (const index of indices) { const page = document.getPage(index); page.setRotation(degrees((page.getRotation().angle + settings.rotation) % 360)) } }
  else if (operation === 'crop') {
    for (const index of indices) { const page = document.getPage(index); const box = page.getMediaBox(); const x = finite(settings.x, box.x, box.x + box.width, 'Crop X'); const y = finite(settings.y, box.y, box.y + box.height, 'Crop Y'); const width = finite(settings.width, 1, box.x + box.width - x, 'Crop width'); const height = finite(settings.height, 1, box.y + box.height - y, 'Crop height'); page.setCropBox(x, y, width, height) }
  } else if (operation === 'resize') { noForms(document); for (const index of indices) { const page = document.getPage(index); page.scale(finite(settings.width, 72, 14400, 'Width') / page.getWidth(), finite(settings.height, 72, 14400, 'Height') / page.getHeight()) } }
  else if (operation === 'blank') { const position = finite(settings.insertAt, 1, document.getPageCount() + 1, 'Insert position'); if (!Number.isInteger(position) || document.getPageCount() === 300) throw new Error('Invalid insert position or page limit exceeded.'); document.insertPage(position - 1, [finite(settings.width, 72, 14400, 'Width'), finite(settings.height, 72, 14400, 'Height')]) }
  else if (['watermark', 'numbers', 'text', 'rectangle', 'image'].includes(operation)) {
    const font = await document.embedFont(StandardFonts.Helvetica)
    const fontSize = finite(settings.fontSize, 6, 200, 'Font size'); const opacity = finite(settings.opacity, 0, 100, 'Opacity') / 100
    const ink = color(settings.color)
    const image = operation === 'image' ? extra ? await embed(document, extra) : null : null
    if (operation === 'image' && !image) throw new Error('Choose a PNG or JPEG overlay.')
    for (const [position, index] of indices.entries()) {
      const page = document.getPage(index); const box = page.getCropBox()
      if (operation === 'watermark') { if (!settings.text.trim()) throw new Error('Watermark text cannot be empty.'); const width = font.widthOfTextAtSize(settings.text, fontSize); page.drawText(settings.text, { x: box.x + (box.width - width) / 2, y: box.y + box.height / 2, font, size: fontSize, color: ink, opacity }) }
      else if (operation === 'numbers') { const start = finite(settings.start, 0, 100000, 'Start number'); if (!Number.isInteger(start)) throw new Error('Start number must be an integer.'); const text = String(start + position); page.drawText(text, { x: box.x + (box.width - font.widthOfTextAtSize(text, fontSize)) / 2, y: box.y + Math.min(24, box.height / 10), font, size: fontSize, color: ink, opacity }) }
      else {
        const x = finite(settings.x, box.x, box.x + box.width, 'X'); const y = finite(settings.y, box.y, box.y + box.height, 'Y')
        if (operation === 'text') { if (!settings.text.trim()) throw new Error('Text cannot be empty.'); page.drawText(settings.text, { x, y, font, size: fontSize, color: ink, opacity, maxWidth: box.x + box.width - x }) }
        else { const width = finite(settings.width, 1, box.x + box.width - x, 'Width'); const height = finite(settings.height, 1, box.y + box.height - y, 'Height'); if (image) page.drawImage(image, { x, y, width, height, opacity }); else page.drawRectangle({ x, y, width, height, color: ink, opacity }) }
      }
    }
  } else if (operation === 'metadata') { document.setTitle(settings.title); document.setAuthor(settings.author); document.setSubject(settings.subject); document.setKeywords(settings.keywords.split(',').map(keyword => keyword.trim()).filter(Boolean)) }
  else if (operation === 'metadata-clear') { document.setTitle(''); document.setAuthor(''); document.setSubject(''); document.setKeywords([]); document.setCreator(''); document.setProducer(''); document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0)); document.catalog.delete(PDFName.of('Metadata')) }
  else if (operation === 'flatten') { document.getForm().flatten() }
  else if (operation === 'fill') {
    const values: unknown = JSON.parse(settings.formValues)
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Form values must be a JSON object keyed by field name.')
    const form = document.getForm()
    for (const [name, value] of Object.entries(values)) { const field = form.getField(name); if (field instanceof PDFTextField && typeof value === 'string') field.setText(value); else if (field instanceof PDFCheckBox && typeof value === 'boolean') { if (value) field.check(); else field.uncheck() } else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && (typeof value === 'string' || Array.isArray(value) && value.every(item => typeof item === 'string'))) field.select(value); else if (field instanceof PDFRadioGroup && typeof value === 'string') field.select(value); else throw new Error(`Unsupported value or field type: ${name}`) }
  } else if (operation === 'attach') { if (!extra || !extra.length || extra.length > 10_000_000) throw new Error('Choose a non-empty attachment under 10 MB.'); const name = settings.attachmentName.replace(/[/\\]/g, '_'); if (!name.trim()) throw new Error('Attachment name is required.'); await document.attach(extra, name) }
  else if (['inspect', 'forms', 'split', 'render', 'text-extract', 'attachments'].includes(operation)) throw new Error('This operation uses the inspection or export API.')
  return document.save({ useObjectStreams: true })
}
export async function splitPDF(bytes: Uint8Array, pages = '') {
  const document = await load(bytes); const indices = pageRange(pages, document.getPageCount()); const files: { name: string; bytes: Uint8Array }[] = []
  for (const index of indices) files.push({ name: `page-${String(index + 1).padStart(3, '0')}.pdf`, bytes: await (await copied(document, [index])).save() })
  return files
}