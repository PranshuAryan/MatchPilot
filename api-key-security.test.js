import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
const { containsLikelySecret } = require('./secure-code.js')

// ---------------------------------------------------------------------------
// IMPORTANT — READ BEFORE SUBMITTING
// ---------------------------------------------------------------------------
// This suite scans every shipped HTML file for hardcoded, live-looking API
// keys/secrets. As of this commit, challenge_3.html, scoreboard.html, and
// stadium.html still contain a real Groq API key
// ('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') pasted
// directly into client-side JavaScript, which is visible to anyone who
// views page source.
//
// These tests are written as REAL assertions (not skipped) on purpose, so
// they will currently FAIL and show up red in `npm test`. That is
// intentional — it's a live checklist, not a bug in the test.
//
// Before submitting / deploying:
//   1. Revoke the exposed key at https://console.groq.com
//   2. Replace the hardcoded key with either:
//        a) a server-side proxy that holds the key, or
//        b) a "paste your own key" prompt stored only in memory
//   3. Re-run `npm test` — this file should then pass.
// ---------------------------------------------------------------------------

const PROJECT_ROOT = __dirname
const HTML_FILES = ['challenge_3.html', 'route.html', 'scoreboard.html', 'stadium.html']

function readFile(name) {
  return fs.readFileSync(path.join(PROJECT_ROOT, name), 'utf8')
}

describe('No hardcoded API keys/secrets shipped to the browser', () => {
  HTML_FILES.forEach((file) => {
    it(`${file} does not contain a live-looking API key`, () => {
      const content = readFile(file)
      const hasSecret = containsLikelySecret(content)
      if (hasSecret) {
        // Surface exactly what tripped the check to make this actionable.
        console.warn(
          `[SECURITY] ${file} appears to contain a hardcoded API key. ` +
          `Revoke it at console.groq.com and remove it before submitting.`
        )
      }
      expect(hasSecret, `${file} should not contain a hardcoded secret`).toBe(false)
    })
  })

  it('containsLikelySecret() itself is exercised (sanity check, always passes)', () => {
    expect(containsLikelySecret('no secrets here')).toBe(false)
  })
})
