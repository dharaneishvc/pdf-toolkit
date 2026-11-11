import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { pdfTools } from './engine'
describe('repository contracts', () => {
  it('documents the catalog count', () => expect(readFileSync(resolve('README.md'), 'utf8')).toContain(`${pdfTools.length} tools`))
  it('has self-contained documentation and verification', () => {
    for (const path of ['README.md', 'VERIFICATION.md', 'docs/ARCHITECTURE.md', 'docs/OPERATIONS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'Jenkinsfile']) expect(existsSync(resolve(path))).toBe(true)
    expect(readFileSync(resolve('README.md'), 'utf8')).toContain('[Verification](VERIFICATION.md)')
    expect(readFileSync(resolve('VERIFICATION.md'), 'utf8')).toContain(`${pdfTools.length} tools`)
    for (const path of ['README.md', 'VERIFICATION.md']) {
      for (const match of readFileSync(resolve(path), 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0]
        if (/^https?:\/\//.test(target)) continue
        expect(target.startsWith('../')).toBe(false)
        expect(existsSync(resolve(target))).toBe(true)
      }
    }
  })
  it('parses CI and gates deployment permissions', () => {
    const workflow = YAML.parse(readFileSync(resolve('.github/workflows/ci.yml'), 'utf8'))
    expect(workflow.on).toHaveProperty('pull_request')
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.verify.permissions).toBeUndefined()
    expect(workflow.jobs.verify['runs-on']).toBe('ubuntu-24.04')
    expect(workflow.jobs.deploy.needs).toBe('verify')
    expect(workflow.jobs.deploy['runs-on']).toBe('ubuntu-24.04')
    expect(workflow.jobs.deploy.if).toContain("github.event_name != 'pull_request'")
    expect(workflow.jobs.deploy.if).toContain('refs/heads/main')
    const commands = workflow.jobs.verify.steps.map((step: { run?: string }) => step.run).filter(Boolean)
    expect(commands).toContain('npm run test:e2e')
    expect(commands).toContain('npx playwright install chromium')
    expect(commands).not.toContain('npx playwright install --with-deps chromium')
  })
  it('parses dependency updates', () => expect(YAML.parse(readFileSync(resolve('.github/dependabot.yml'), 'utf8')).updates).toHaveLength(2))
})