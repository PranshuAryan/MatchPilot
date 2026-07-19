import { describe, it, expect } from 'vitest'
const {
  sanitizeInput,
  escapeHtml,
  escapeHtmlMultiline,
  escapeAttr,
  containsLikelySecret,
  MAX_INPUT_LENGTH,
} = require('./secure-code.js')

describe('sanitizeInput()', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world')
  })

  it('returns empty string for null/undefined/non-string input', () => {
    expect(sanitizeInput(null)).toBe('')
    expect(sanitizeInput(undefined)).toBe('')
    expect(sanitizeInput(42)).toBe('')
    expect(sanitizeInput({})).toBe('')
  })

  it('caps length at MAX_INPUT_LENGTH by default', () => {
    const long = 'a'.repeat(3000)
    expect(sanitizeInput(long).length).toBe(MAX_INPUT_LENGTH)
  })

  it('respects a custom max length', () => {
    expect(sanitizeInput('abcdefgh', 3)).toBe('abc')
  })

  it('strips control and zero-width characters', () => {
    const withControls = 'hello\u0000\u200Bworld'
    expect(sanitizeInput(withControls)).toBe('helloworld')
  })

  it('preserves legitimate punctuation instead of stripping it', () => {
    // Regression test: the old implementation stripped <>"'` which mangled
    // normal text like "it's" or "cost < $10". Sanitization should not be
    // lossy — HTML safety is the job of escapeHtml/escapeAttr at render time.
    expect(sanitizeInput("it's a 5<10 comparison, \"quoted\"")).toBe(
      "it's a 5<10 comparison, \"quoted\""
    )
  })
})

describe('escapeHtml()', () => {
  it('escapes the five HTML-significant characters', () => {
    const result = escapeHtml(`<script>alert("x")</script>&'`)
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    expect(result).toContain('&amp;')
  })

  it('neutralizes a classic image-onerror XSS payload', () => {
    const payload = `<img src=x onerror=alert(1)>`
    const result = escapeHtml(payload)
    expect(result).not.toContain('<img')
    expect(result).not.toMatch(/<[a-z]+[\s>]/i)
  })

  it('neutralizes an attribute-breakout payload', () => {
    const payload = `"><svg onload=alert(1)>`
    const result = escapeHtml(payload)
    expect(result).not.toContain('<svg')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('coerces non-string input to string safely', () => {
    expect(escapeHtml(123)).toBe('123')
  })
})

describe('escapeHtmlMultiline()', () => {
  it('converts newlines to <br/> after escaping', () => {
    const result = escapeHtmlMultiline('line one\nline two')
    expect(result).toBe('line one<br/>line two')
  })

  it('still escapes HTML-significant characters across lines', () => {
    const result = escapeHtmlMultiline('<b>bold</b>\n<i>italic</i>')
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('<i>')
  })
})

describe('escapeAttr()', () => {
  it('neutralizes double quotes so text cannot break out of a "..." attribute', () => {
    const payload = `x" onclick="alert(1)`
    const result = escapeAttr(payload)
    expect(result).not.toContain('"')
  })

  it('neutralizes backticks so text cannot break out of a template literal', () => {
    const payload = 'x`; alert(1); `'
    const result = escapeAttr(payload)
    expect(result).not.toContain('`')
  })

  it('neutralizes single quotes and backslashes', () => {
    const payload = `x'\\y`
    const result = escapeAttr(payload)
    expect(result).not.toContain("'")
  })

  it('collapses newlines to spaces and caps length at 500', () => {
    const long = 'a'.repeat(600) + '\nmore'
    const result = escapeAttr(long)
    expect(result.length).toBeLessThanOrEqual(500)
    expect(result).not.toContain('\n')
  })
})

describe('containsLikelySecret()', () => {
  it('flags a Groq-style API key', () => {
    expect(containsLikelySecret('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')).toBe(true)
  })

  it('flags an OpenAI-style key embedded in surrounding text', () => {
    expect(containsLikelySecret("const KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456'")).toBe(true)
  })

  it('does not flag ordinary text', () => {
    expect(containsLikelySecret('Welcome to MatchPilot! Ask about stadium routes.')).toBe(false)
  })

  it('handles non-string input without throwing', () => {
    expect(containsLikelySecret(null)).toBe(false)
    expect(containsLikelySecret(undefined)).toBe(false)
    expect(containsLikelySecret(42)).toBe(false)
  })
})
