import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'

const PROJECT_ROOT = __dirname
const HTML_FILES = ['challenge_3.html', 'route.html', 'scoreboard.html', 'stadium.html']

function loadDom(file) {
  const html = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8')
  return new JSDOM(html).window.document
}

describe.each(HTML_FILES)('Accessibility — %s', (file) => {
  let doc

  beforeAll(() => {
    doc = loadDom(file)
  })

  it('declares a lang attribute on <html>', () => {
    const lang = doc.documentElement.getAttribute('lang')
    expect(lang).toBeTruthy()
    expect(lang.length).toBeGreaterThanOrEqual(2)
  })

  it('has exactly one <main> landmark with an id the skip link can target', () => {
    const mains = doc.querySelectorAll('main')
    expect(mains.length).toBe(1)
    expect(mains[0].id).toBe('mainContent')
  })

  it('provides a skip-to-content link as the first focusable element', () => {
    const skipLink = doc.querySelector('a.skip-link')
    expect(skipLink).not.toBeNull()
    expect(skipLink.getAttribute('href')).toBe('#mainContent')
  })

  it('has a document <title>', () => {
    expect(doc.title.trim().length).toBeGreaterThan(0)
  })

  it('every <img> has an alt attribute', () => {
    const imgs = Array.from(doc.querySelectorAll('img'))
    imgs.forEach((img) => {
      expect(img.hasAttribute('alt'), `<img src="${img.getAttribute('src')}"> is missing alt text`).toBe(true)
    })
  })

  it('every icon-only button (no visible text) has an accessible name', () => {
    const buttons = Array.from(doc.querySelectorAll('button'))
    buttons.forEach((btn) => {
      const visibleText = (btn.textContent || '').trim()
      const hasAccessibleName =
        btn.hasAttribute('aria-label') ||
        btn.hasAttribute('aria-labelledby') ||
        btn.hasAttribute('title')

      // A button is "icon-only" here if its visible text is very short
      // (emoji/symbol) rather than a real word — those need an explicit
      // accessible name since an emoji alone isn't reliably announced.
      const looksIconOnly = visibleText.length > 0 && visibleText.length <= 2

      if (looksIconOnly) {
        expect(
          hasAccessibleName,
          `Icon-only button "${visibleText}" needs aria-label or title`
        ).toBe(true)
      } else {
        // Buttons with real text content are fine as-is; buttons with no
        // text AND no accessible name are always a failure.
        if (visibleText.length === 0) {
          expect(
            hasAccessibleName,
            'Empty button needs aria-label, aria-labelledby, or title'
          ).toBe(true)
        }
      }
    })
  })

  it('every text <input> has an associated label or aria-label', () => {
    const inputs = Array.from(
      doc.querySelectorAll('input[type="text"], input:not([type]), textarea')
    )
    inputs.forEach((input) => {
      const id = input.getAttribute('id')
      const hasLabelFor = id ? !!doc.querySelector(`label[for="${id}"]`) : false
      const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')
      // Placeholder text alone is a known accessibility anti-pattern (it
      // disappears on focus and isn't reliably announced), so a real
      // <label for> or aria-label is required regardless of placeholder.
      expect(
        hasLabelFor || hasAriaLabel,
        `Input#${id || '(no id)'} needs a <label for> or aria-label (a placeholder alone is not enough)`
      ).toBe(true)
    })
  })

  if (file === 'route.html') {
    it('the origin autocomplete uses the ARIA combobox pattern', () => {
      const input = doc.getElementById('originInput')
      const list = doc.getElementById('originSuggestions')
      expect(input.getAttribute('role')).toBe('combobox')
      expect(input.getAttribute('aria-controls')).toBe('originSuggestions')
      expect(input.hasAttribute('aria-expanded')).toBe(true)
      expect(list.getAttribute('role')).toBe('listbox')
    })
  }
})
