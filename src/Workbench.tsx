import { useEffect, useRef, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'
import { ArrowDownToLine, ArrowUp, ArrowDown, FilePlus2, FlaskConical, Play, Square, Trash2, RotateCw, CheckSquare, ArrowRightLeft, FileText, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import { Shell, IconButton } from './Shell'
import { defaults, pdfTools, pageRange } from './engine'
import type { PDFOptions } from './engine'
import { openPDF, closePDF, blobFromBytes, download } from './browser'
import type { PDFDocumentProxy, RenderTask } from './browser'
import { recordHistory } from './storage'
import './ui.css'
import './theme.css'

type Asset = { id: string; name: string; bytes: Uint8Array; document: PDFDocumentProxy | null }
type WorkerResult = { error?: string; bytes?: Uint8Array; files?: { name: string; bytes: Uint8Array }[]; report?: unknown }
function initialTool() { return pdfTools.find(tool => tool.id === location.hash.slice(1))?.id ?? 'merge' }
function Thumbnail({ document, page, onClick, selected }: { document: PDFDocumentProxy; page: number; onClick: () => void; selected: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      document.getPage(page).then(async source => {
        if (cancelled || !canvas.current) return
        const natural = source.getViewport({ scale: 1 }); const viewport = source.getViewport({ scale: Math.min(140 / natural.width, 180 / natural.height) })
        canvas.current.width = Math.ceil(viewport.width); canvas.current.height = Math.ceil(viewport.height)
        task = source.render({ canvas: canvas.current, viewport }); await task.promise
      }).catch(() => { if (!cancelled) setError('Preview unavailable') })
    }, { rootMargin: '100px' })
    if (button.current) observer.observe(button.current)
    return () => { cancelled = true; observer.disconnect(); task?.cancel() }
  }, [document, page])
  return <div className={`page-item ${selected ? 'selected' : ''}`}><button ref={button} className="page-preview" aria-label={`Select page ${page}`} aria-pressed={selected} onClick={onClick}><canvas ref={canvas} aria-label={`Page ${page} preview`} />{error && <span>{error}</span>}</button><footer><span>Page {page}</span>{selected && <CheckSquare size={14} />}</footer></div>
}
export default function App() {
  const [active, setActive] = useState(initialTool)
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [options, setOptions] = useState<PDFOptions>({ ...defaults })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('Ready')
  const [output, setOutput] = useState<{ blob: Blob; name: string } | null>(null)
  const [report, setReport] = useState('')
  const [extra, setExtra] = useState<File | null>(null)
  const [imageFormat, setImageFormat] = useState('image/png')
  const [scale, setScale] = useState(1.5)
  const [dragging, setDragging] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const owned = useRef<Asset[]>([])
  const alive = useRef(true)
  const job = useRef<{ worker: Worker; reject: (reason: Error) => void } | null>(null)
  const generation = useRef(0)
  const exportRender = useRef<RenderTask | null>(null)
  const selected = assets.find(asset => asset.id === selectedId) ?? assets[0]
  function stop() { generation.current++; exportRender.current?.cancel(); exportRender.current = null; if (job.current) { job.current.worker.terminate(); job.current.reject(new Error('Cancelled')); job.current = null }; setBusy(false); setProgress('Stopped') }
  function selectTool(id: string) { stop(); setActive(id); setOptions({ ...defaults }); setExtra(null); setOutput(null); setReport(''); setError(''); setProgress('Ready') }
  useEffect(() => {
    alive.current = true
    const hash = () => { generation.current++; exportRender.current?.cancel(); exportRender.current = null; job.current?.worker.terminate(); job.current?.reject(new Error('Cancelled')); job.current = null; setBusy(false); setActive(initialTool()); setOutput(null); setReport(''); setOptions({ ...defaults }) }
    window.addEventListener('hashchange', hash)
    return () => { alive.current = false; generation.current++; exportRender.current?.cancel(); job.current?.worker.terminate(); job.current?.reject(new Error('Cancelled')); window.removeEventListener('hashchange', hash); owned.current.forEach(asset => closePDF(asset.document)) }
  }, [])
  useEffect(() => {
    if (!selected?.document || !previewCanvas.current || active !== 'render') return
    let cancelled = false; let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    selected.document.getPage(Math.min(previewPage, selected.document.numPages)).then(async page => {
      if (cancelled || !previewCanvas.current) return
      const natural = page.getViewport({ scale: 1 }); const viewport = page.getViewport({ scale: Math.min(700 / natural.width, 600 / natural.height) }); previewCanvas.current.width = Math.ceil(viewport.width); previewCanvas.current.height = Math.ceil(viewport.height)
      task = page.render({ canvas: previewCanvas.current, viewport }); await task.promise
    }).catch(() => { if (!cancelled) setError('Page preview unavailable.') })
    return () => { cancelled = true; task?.cancel() }
  }, [selected, previewPage, active])
  function update(patch: Partial<PDFOptions>) { setOptions(previous => ({ ...previous, ...patch })); setOutput(null); setError('') }
  async function add(files: File[], imageMode = active === 'images-pdf') {
    if (!files.length || busy) return
    setBusy(true); setError(''); const additions: Asset[] = []
    try {
      if (assets.length + files.length > 24 || assets.reduce((sum, asset) => sum + asset.bytes.length, 0) + files.reduce((sum, file) => sum + file.size, 0) > 100_000_000) throw new Error('Use at most 24 files totaling 100 MB.')
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (imageMode) { if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Images to PDF accepts PNG and JPEG only.'); additions.push({ id: crypto.randomUUID(), name: file.name, bytes, document: null }) }
        else {
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose PDF files.')
          let document: PDFDocumentProxy
          try { document = await openPDF(bytes) } catch { throw new Error(`Cannot open ${file.name}. Encrypted or corrupt PDFs are unsupported.`) }
          if (document.numPages < 1 || document.numPages > 300) { closePDF(document); throw new Error('PDFs are limited to 300 pages.') }
          additions.push({ id: crypto.randomUUID(), name: file.name, bytes, document })
        }
      }
      if (!alive.current) { additions.forEach(asset => closePDF(asset.document)); return }
      owned.current = [...owned.current, ...additions]; setAssets(previous => [...previous, ...additions]); setSelectedId(additions[0].id); setPreviewPage(1); setOutput(null); setReport(''); update({ pages: '' }); setProgress('Ready')
    } catch (caught) { additions.forEach(asset => closePDF(asset.document)); setError(caught instanceof Error ? caught.message : 'Import failed.') }
    finally { if (alive.current) setBusy(false) }
  }
  async function sample() {
    const document = await PDFDocument.create(); const font = await document.embedFont(StandardFonts.Helvetica)
    for (let index = 0; index < 3; index++) { const page = document.addPage([595, 842]); page.drawRectangle({ x: 0, y: 720, width: 595, height: 122, color: rgb(.05, .48, .53) }); page.drawText('PDF TOOLKIT', { x: 40, y: 784, font, size: 20, color: rgb(1, 1, 1) }); page.drawText(['Project brief', 'Design notes', 'Release checklist'][index], { x: 40, y: 660, font, size: 28 }); page.drawText(`Sample page ${index + 1}\n\nThis document was generated on your device.\n\nA browser-native toolkit for everyday document work.`, { x: 40, y: 590, font, size: 14, lineHeight: 26 }); page.drawText(String(index + 1), { x: 290, y: 35, font, size: 12 }) }
    document.setTitle('PDF Toolkit sample'); document.setAuthor('Dharaneish V C'); await add([new File([new Uint8Array(await document.save()).buffer], 'sample.pdf', { type: 'application/pdf' })], false)
  }
  function remove(asset: Asset) { closePDF(asset.document); owned.current = owned.current.filter(item => item.id !== asset.id); setAssets(previous => previous.filter(item => item.id !== asset.id)); setOutput(null); update({ pages: '' }) }
  async function reuseResult() {
    if (!output || busy) return
    setBusy(true); setError('')
    try {
      const bytes = new Uint8Array(await output.blob.arrayBuffer()); const document = await openPDF(bytes)
      owned.current.forEach(asset => closePDF(asset.document))
      const asset = { id: crypto.randomUUID(), name: output.name, bytes, document }
      owned.current = [asset]; setAssets([asset]); setSelectedId(asset.id); setPreviewPage(1); setOutput(null); setReport(''); update({ pages: '' })
    } catch { setError('Could not reopen the result. The original input is unchanged.') }
    finally { setBusy(false) }
  }
  function move(index: number, direction: number) { setAssets(previous => { const next = [...previous]; const other = index + direction; if (other < 0 || other >= next.length) return next; [next[index], next[other]] = [next[other], next[index]]; return next }); setOutput(null) }
  function togglePage(page: number) {
    if (!selected?.document) return
    let indices: number[]; try { indices = options.pages.trim() ? pageRange(options.pages, selected.document.numPages) : [] } catch { indices = [] }
    const next = indices.includes(page - 1) ? indices.filter(index => index !== page - 1) : [...indices, page - 1]
    update({ pages: next.map(index => index + 1).join(',') })
  }
  function workerRun(inputs: Uint8Array[], extraBytes?: Uint8Array): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); job.current = { worker, reject }
      const timer = setTimeout(() => { worker.terminate(); job.current = null; reject(new Error('PDF job exceeded 60 seconds. Reduce the document size.')) }, 60000)
      const finish = () => { clearTimeout(timer); worker.terminate(); job.current = null }
      job.current.reject = reason => { clearTimeout(timer); reject(reason) }
      worker.onmessage = event => { finish(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data) }
      worker.onerror = () => { finish(); reject(new Error('PDF worker failed.')) }
      worker.postMessage({ inputs, operation: active, options, extra: extraBytes })
    })
  }
  async function run() {
    if (!selected || busy) return
    const token = ++generation.current; setBusy(true); setError(''); setOutput(null); setReport(''); setProgress('Processing...')
    try {
      const imageMode = active === 'images-pdf'
      if (imageMode && assets.some(asset => asset.document)) throw new Error('Remove PDFs before converting images. Add PNG or JPEG files.')
      if (!imageMode && !selected.document) throw new Error('Select a PDF, not an image.')
      let blob: Blob | undefined; let name = `${active}.pdf`
      if (['render', 'text-extract', 'attachments'].includes(active)) {
        const document = selected.document!; const indices = pageRange(options.pages, document.numPages)
        const zip = new JSZip(); let text = ''
        if (active === 'attachments') {
          const attachments = await document.getAttachments(); if (!attachments?.size) throw new Error('This PDF has no embedded attachments.')
          let index = 0; let total = 0
          for (const [id, attachment] of attachments) {
            if (token !== generation.current) throw new Error('Cancelled')
            const content = attachment.content ?? await document.getAttachmentContent(id)
            if (!content) throw new Error(`Cannot read attachment ${attachment.filename}.`)
            total += content.length; if (total > 100_000_000) throw new Error('Expanded attachments exceed 100 MB.')
            zip.file(`${++index}-${attachment.filename.replace(/[/\\]/g, '_')}`, content)
          }
          blob = await zip.generateAsync({ type: 'blob' }); name = 'attachments.zip'
        } else {
          if (active === 'render' && (!Number.isFinite(scale) || scale < .25 || scale > 3)) throw new Error('Render scale must be between 0.25 and 3.')
          for (const [position, index] of indices.entries()) {
            if (token !== generation.current) throw new Error('Cancelled')
            setProgress(`Page ${position + 1} of ${indices.length}`)
            const page = await document.getPage(index + 1)
            if (active === 'text-extract') { const content = await page.getTextContent(); text += `--- Page ${index + 1} ---\n` + content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('') + '\n\n' }
            else {
              const viewport = page.getViewport({ scale }); if (viewport.width * viewport.height > 16_000_000 || viewport.width > 8192 || viewport.height > 8192) throw new Error('Rendered page exceeds the canvas limit. Reduce the scale.')
              const canvas = window.document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
              const task = page.render({ canvas, viewport, intent: 'print' }); exportRender.current = task
              try { await task.promise } finally { if (exportRender.current === task) exportRender.current = null }
              const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed.')), imageFormat, .9)); zip.file(`page-${String(index + 1).padStart(3, '0')}.${imageFormat === 'image/png' ? 'png' : 'jpg'}`, image); canvas.width = 0; canvas.height = 0
            }
          }
          if (active === 'text-extract') { setReport(text); blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); name = 'extracted-text.txt' }
          else { blob = await zip.generateAsync({ type: 'blob' }); name = 'pdf-pages.zip' }
        }
      } else {
        const inputs = active === 'merge' || imageMode ? assets.map(asset => asset.bytes) : [selected.bytes]
        if (active === 'merge' && assets.some(asset => !asset.document)) throw new Error('Merge accepts only PDF files.')
        const extraBytes = extra ? new Uint8Array(await extra.arrayBuffer()) : undefined
        const response = await workerRun(inputs, extraBytes)
        if (response.report) { const data = active === 'forms' ? (response.report as { forms: unknown }).forms : response.report; const text = JSON.stringify(data, null, 2); setReport(text); blob = new Blob([text], { type: 'application/json' }); name = `${active}.json`; if (active === 'inspect') { const info = response.report as { title: string; author: string; subject: string; keywords: string }; setOptions(previous => ({ ...previous, title: info.title, author: info.author, subject: info.subject, keywords: info.keywords })) } }
        else if (response.files) { const zip = new JSZip(); response.files.forEach(file => zip.file(file.name, file.bytes)); blob = await zip.generateAsync({ type: 'blob' }); name = 'split-pages.zip' }
        else if (response.bytes) blob = blobFromBytes(response.bytes)
      }
      if (token !== generation.current) return
      if (blob) setOutput({ blob, name }); setProgress('Complete'); await recordHistory(active, pdfTools.find(tool => tool.id === active)!.name)
    } catch (caught) { if (token === generation.current) { setError(caught instanceof Error ? caught.message : 'Processing failed.'); setProgress('Failed') } }
    finally { if (token === generation.current) setBusy(false) }
  }
  function numeric(key: keyof PDFOptions, label: string, min = 0, max = 14400) { return <label>{label}<input type="number" min={min} max={max} value={Number(options[key])} onChange={event => update({ [key]: Number(event.target.value) })} /></label> }
  const dimensionsTools = ['crop', 'resize', 'blank', 'rectangle', 'image', 'images-pdf']
  const positioned = ['crop', 'text', 'rectangle', 'image']
  const textTools = ['watermark', 'numbers', 'text']
  let selectedPages: number[] = []; if (selected?.document && options.pages.trim()) { try { selectedPages = pageRange(options.pages, selected.document.numPages) } catch { selectedPages = [] } }
  return <Shell title="PDF Toolkit" subtitle="PDF" tools={pdfTools} active={active} onSelect={selectTool}><div className="workbench">
    <input ref={fileInput} type="file" hidden multiple accept={active === 'images-pdf' ? 'image/png,image/jpeg' : 'application/pdf'} onChange={event => { void add(Array.from(event.target.files ?? [])); event.target.value = '' }} />
    <div className="section-toolbar pdf-toolbar"><div className="actions"><button className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}><FilePlus2 size={16} />{active === 'images-pdf' ? 'Add images' : 'Add PDFs'}</button><IconButton label="Load sample PDF" disabled={busy} onClick={() => { sample().catch(() => setError('Could not generate sample PDF.')) }}><FlaskConical size={18} /></IconButton></div><span className="document-count">{assets.length} files</span></div>
    <div className="workspace-grid"><section>
      {!assets.length && <div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void add(Array.from(event.dataTransfer.files)) }}><FileText size={42} /><button className="primary-button" disabled={busy} onClick={() => fileInput.current?.click()}><FilePlus2 size={16} />{active === 'images-pdf' ? 'Open images' : 'Open PDFs'}</button>{active !== 'images-pdf' && <button className="secondary-button" disabled={busy} onClick={() => { sample().catch(() => setError('Could not generate sample PDF.')) }}><FlaskConical size={16} />Load sample</button>}</div>}
      <div className="asset-list">{assets.map((asset, index) => <div className={`asset-row ${selected?.id === asset.id ? 'selected' : ''}`} key={asset.id}><FileText size={20} /><button className="asset-name" disabled={busy} onClick={() => { setSelectedId(asset.id); setPreviewPage(1); setOutput(null); setReport(''); update({ pages: '' }) }}><strong>{asset.name}</strong><small>{asset.document ? `${asset.document.numPages} pages / ` : ''}{(asset.bytes.length / 1024).toFixed(1)} KB</small></button><IconButton label={`Move ${asset.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></IconButton><IconButton label={`Move ${asset.name} down`} disabled={busy || index === assets.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></IconButton><IconButton label={`Remove ${asset.name}`} disabled={busy} onClick={() => remove(asset)}><Trash2 size={15} /></IconButton></div>)}</div>
      {selected?.document && active === 'render' && <><div className="section-toolbar"><h3>Page {previewPage}</h3><div className="actions"><IconButton label="Previous preview page" disabled={previewPage <= 1} onClick={() => setPreviewPage(previous => previous - 1)}><ChevronLeft size={18} /></IconButton><IconButton label="Next preview page" disabled={previewPage >= selected.document!.numPages} onClick={() => setPreviewPage(previous => previous + 1)}><ChevronRight size={18} /></IconButton></div></div><div className="preview-stage pdf-preview"><canvas ref={previewCanvas} aria-label="PDF page preview" /></div></>}
      {selected?.document && active !== 'render' && <div className="page-grid">{Array.from({ length: selected.document.numPages }, (_unused, index) => <Thumbnail key={`${selected.id}-${index}`} document={selected.document!} page={index + 1} selected={selectedPages.includes(index)} onClick={() => togglePage(index + 1)} />)}</div>}
      {report && <div className="report-section"><div className="section-toolbar"><h3>Result</h3><IconButton label="Copy report" onClick={() => { navigator.clipboard.writeText(report).then(() => setProgress('Copied')).catch(() => setError('Clipboard unavailable.')) }}><Copy size={17} /></IconButton></div><pre className="metadata" aria-label="PDF report">{report}</pre></div>}
    </section><aside className="control-panel" aria-label="PDF operation settings">
      {active !== 'merge' && active !== 'images-pdf' && <label>Pages / order<input placeholder="All pages" value={options.pages} onChange={event => update({ pages: event.target.value })} /></label>}
      {active === 'rotate' && <label>Rotation<select value={options.rotation} onChange={event => update({ rotation: Number(event.target.value) })}>{[0, 90, 180, 270].map(rotation => <option value={rotation} key={rotation}>{rotation} degrees</option>)}</select></label>}
      {textTools.includes(active) && <>{active !== 'numbers' && <label>Text<textarea className="settings-textarea" value={options.text} maxLength={2000} onChange={event => update({ text: event.target.value })} /></label>}{numeric('fontSize', 'Font size (pt)', 6, 200)}</>}
      {['watermark', 'numbers', 'text', 'rectangle', 'image'].includes(active) && <>{active !== 'image' && <label>Color<input type="color" value={options.color} onChange={event => update({ color: event.target.value })} /></label>}<label>Opacity: {options.opacity}%<input type="range" min="0" max="100" value={options.opacity} onChange={event => update({ opacity: Number(event.target.value) })} /></label></>}
      {positioned.includes(active) && <div className="control-row">{numeric('x', 'X from left (pt)')}{numeric('y', 'Y from bottom (pt)')}</div>}
      {dimensionsTools.includes(active) && <div className="control-row">{numeric('width', 'Width (pt)', 1)}{numeric('height', 'Height (pt)', 1)}</div>}
      {active === 'numbers' && numeric('start', 'Start number', 0, 100000)}{active === 'blank' && numeric('insertAt', 'Insert before page', 1, 301)}
      {active === 'metadata' && <>{(['title', 'author', 'subject', 'keywords'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input value={options[key]} maxLength={1000} onChange={event => update({ [key]: event.target.value })} /></label>)}</>}
      {active === 'fill' && <label>Field values (JSON)<textarea className="settings-textarea" aria-label="Field values (JSON)" value={options.formValues} onChange={event => update({ formValues: event.target.value })} /></label>}
      {(active === 'image' || active === 'attach') && <><label>{active === 'image' ? 'Overlay image' : 'Attachment'}<input type="file" accept={active === 'image' ? 'image/png,image/jpeg' : undefined} onChange={event => { const file = event.target.files?.[0]; if (file && file.size > 10_000_000) { setError('Extra files must be under 10 MB.'); event.target.value = ''; setExtra(null) } else { setExtra(file ?? null); if (file) update({ attachmentName: file.name }) } }} /></label>{active === 'attach' && <label>Attachment filename<input value={options.attachmentName} onChange={event => update({ attachmentName: event.target.value })} /></label>}</>}
      {active === 'render' && <><label>Image format<select value={imageFormat} onChange={event => setImageFormat(event.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label><label>Render scale<input type="number" min="0.25" max="3" step="0.25" value={scale} onChange={event => setScale(Number(event.target.value))} /></label></>}
      <button className="primary-button" disabled={!selected} onClick={busy ? stop : () => { void run() }}>{busy ? <Square size={16} /> : active === 'rotate' ? <RotateCw size={16} /> : <Play size={16} />}{busy ? 'Stop' : 'Run'}</button>
      {output && <><button className="secondary-button" onClick={() => download(output.blob, output.name)}><ArrowDownToLine size={16} />Download</button>{output.blob.type === 'application/pdf' && <button className="secondary-button" disabled={busy} onClick={() => { void reuseResult() }}><ArrowRightLeft size={16} />Use result as input</button>}</>}
    </aside></div><div className="result-bar"><span role="status">{progress}</span>{output && <span>{output.name} / {(output.blob.size / 1024).toFixed(1)} KB</span>}{error && <p className="error" role="alert">{error}</p>}</div>
  </div></Shell>
}