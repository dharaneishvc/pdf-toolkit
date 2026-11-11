import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { pdfTools } from '../src/engine'

test('sample thumbnails have painted pixels and accessible responsive layout', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.page-item')).toHaveCount(3)
  await expect.poll(() => page.locator('canvas').first().evaluate(canvas => { const source = canvas as HTMLCanvasElement; if (source.width === 300) return false; const data = source.getContext('2d')!.getImageData(0, 0, source.width, source.height).data; return data.some((value, index) => index % 4 !== 3 && value > 0 && value < 240) })).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/pdf-${await page.evaluate(() => window.innerWidth)}.png`, fullPage: true })
})
test('rotates selected pages and reopens the result', async ({ page }) => {
  await page.goto('/#rotate'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.page-item')).toHaveCount(3)
  await page.getByRole('button', { name: 'Select page 2', exact: true }).click(); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const document = await PDFDocument.load(await readFile((await (await downloaded).path())!)); expect(document.getPages().map(page => page.getRotation().angle)).toEqual([0, 90, 0])
  await page.getByRole('button', { name: 'Use result as input', exact: true }).click(); await expect(page.locator('.asset-name')).toContainText('rotate.pdf'); await expect(page.locator('.page-item')).toHaveCount(3); await expect(page.getByRole('alert')).toHaveCount(0)
})
test('merges, extracts text, and splits valid PDFs', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(1); await page.getByRole('button', { name: 'Load sample PDF', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible(); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); expect((await PDFDocument.load(await readFile((await (await downloaded).path())!))).getPageCount()).toBe(6)
  await page.evaluate(() => { location.hash = 'text-extract' }); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByLabel('PDF report', { exact: true })).toContainText('Project brief')
  await page.evaluate(() => { location.hash = 'split' }); await page.getByLabel('Pages / order', { exact: true }).fill('1,3'); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible(); const split = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const zip = await JSZip.loadAsync(await readFile((await (await split).path())!)); expect(Object.keys(zip.files)).toHaveLength(2); expect((await PDFDocument.load(await zip.file('page-003.pdf')!.async('uint8array'))).getPageCount()).toBe(1)
})
test('PDF to image preview and ZIP export are nonblank', async ({ page }) => {
  await page.goto('/#render'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect.poll(() => page.getByLabel('PDF page preview', { exact: true }).evaluate(canvas => (canvas as HTMLCanvasElement).width)).not.toBe(300)
  await page.getByLabel('Pages / order', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible({ timeout: 15000 }); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const zip = await JSZip.loadAsync(await readFile((await (await downloaded).path())!)); const image = await zip.file('page-001.png')!.async('nodebuffer'); expect(image.readUInt32BE(16)).toBeGreaterThan(500)
})
test('each PDF tool has controls without mobile overflow', async ({ page }, testInfo) => {
  await page.goto('/')
  for (const tool of pdfTools) {
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await page.getByRole('button', { name: tool.name, exact: true }).click(); await expect(page.getByRole('heading', { name: tool.name, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
test('rejects invalid ranges and corrupt PDFs', async ({ page }) => {
  await page.goto('/#delete'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.page-item')).toHaveCount(3); await page.getByLabel('Pages / order', { exact: true }).fill('99'); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('between 1 and 3')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') }); await expect(page.getByRole('alert')).toContainText('Cannot open'); await expect(page.locator('.asset-row')).toHaveCount(1)
})
test('form filling, inspection, and flattening roundtrip', async ({ page }) => {
  const source = await PDFDocument.create(); const sourcePage = source.addPage([300, 400]); const field = source.getForm().createTextField('name'); field.setText('Alpha'); field.addToPage(sourcePage, { x: 20, y: 30, width: 100, height: 20 })
  await page.goto('/#fill'); await page.locator('input[type=file]').first().setInputFiles({ name: 'form.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await source.save()) }); await expect(page.locator('.asset-row')).toHaveCount(1)
  await page.getByLabel('Field values (JSON)', { exact: true }).fill('{"name":"Beta"}'); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Use result as input', exact: true }).click(); await expect(page.locator('.asset-name')).toContainText('fill.pdf')
  await page.evaluate(() => { location.hash = 'forms' }); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByLabel('PDF report', { exact: true })).toContainText('Beta')
  await page.evaluate(() => { location.hash = 'flatten' }); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible(); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); expect((await PDFDocument.load(await readFile((await (await downloaded).path())!))).getForm().getFields()).toHaveLength(0)
})
test('attachment insertion and extraction preserve content', async ({ page }) => {
  await page.goto('/#attach'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(1)
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('A local attachment') }); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Use result as input', exact: true }).click(); await expect(page.locator('.asset-name')).toContainText('attach.pdf'); await page.evaluate(() => { location.hash = 'attachments' }); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); const zip = await JSZip.loadAsync(await readFile((await (await downloaded).path())!)); expect(await zip.file('1-note.txt')!.async('string')).toBe('A local attachment')
})
test('PNG to PDF and image overlay create readable documents', async ({ page }) => {
  await page.goto('/#images-pdf')
  const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50; const context = canvas.getContext('2d')!; context.fillStyle = '#ff0000'; context.fillRect(0, 0, 100, 50); return canvas.toDataURL().split(',')[1] }); const file = { name: 'red.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') }
  await page.locator('input[type=file]').first().setInputFiles(file); await expect(page.locator('.asset-row')).toHaveCount(1); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Use result as input', exact: true }).click(); await expect(page.locator('.page-item')).toHaveCount(1); await page.evaluate(() => { location.hash = 'image' }); await page.locator('input[type=file]').nth(1).setInputFiles(file); await page.getByLabel('Width (pt)', { exact: true }).fill('40'); await page.getByLabel('Height (pt)', { exact: true }).fill('40'); await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click(); expect((await PDFDocument.load(await readFile((await (await downloaded).path())!))).getPageCount()).toBe(1); await expect(page.getByRole('alert')).toHaveCount(0)
})