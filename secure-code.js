/**
 * MatchPilot — Secure Code Module
 * ---------------------------------------------------------------------------
 * Single, audited source of truth for input sanitization and HTML/attribute
 * escaping, shared by challenge_3.html, route.html, scoreboard.html and
 * stadium.html.
 *
 * Why this file exists:
 * Each page previously carried its own copy/paste `sanitize()` helper, and
 * one of them (challenge_3.html) escaped `<` and `>` but NOT `"` or `'`,
 * which is unsafe whenever the escaped text is later interpolated into an
 * HTML attribute (e.g. an inline onclick string). Centralizing the logic
 * here means there is exactly one implementation to review, test, and trust.
 *
 * Exposes `window.MatchPilotSecurity` in the browser and also supports
 * CommonJS/ESM `require`/`import` for unit testing with Vitest + jsdom.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // CommonJS (Node / Vitest)
  }
  if (root) {
    root.MatchPilotSecurity = api; // Browser global
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_INPUT_LENGTH = 2000;

  /**
   * Trim, cap length, and strip control/zero-width characters from raw user
   * input (e.g. chat box text) BEFORE it is used for anything — sent to an
   * API, stored, or rendered. This does not remove `<>"'` because escaping
   * (see escapeHtml/escapeAttr) is the correct, non-lossy way to make text
   * safe for display; stripping characters silently mangles legitimate
   * input (e.g. someone typing "it's" or a stadium named with an ampersand).
   */
  function sanitizeInput(str, maxLength) {
    if (str === null || str === undefined || typeof str !== 'string') return '';
    const limit = typeof maxLength === 'number' && maxLength > 0 ? maxLength : MAX_INPUT_LENGTH;
    return str
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\uFEFF]/g, '')
      .trim()
      .slice(0, limit);
  }

  /**
   * Escape a string for safe insertion as HTML *text content* (i.e. between
   * tags, such as `<div>HERE</div>`). Uses the browser's own DOM
   * serialization when available, which is the most reliable way to escape
   * HTML (no bespoke regex to get wrong). Falls back to a manual regex
   * implementation in non-DOM environments (Node/Vitest).
   */
  function escapeHtml(str) {
    const text = str === null || str === undefined ? '' : String(str);
    if (typeof document !== 'undefined' && document.createElement) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Same as escapeHtml but also converts newlines to <br/>, for rendering
   * multi-line chat/advisory text inside a single block element.
   */
  function escapeHtmlMultiline(str) {
    const text = str === null || str === undefined ? '' : String(str);
    return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br/>');
  }

  /**
   * Escape a string for safe insertion inside an HTML *attribute value*
   * delimited by double quotes (e.g. `onclick="...HERE..."`). This is
   * stricter than escapeHtml: it also neutralizes single quotes, backticks
   * and backslashes so the string cannot break out of a JS string literal
   * that itself lives inside an HTML attribute.
   */
  function escapeAttr(str) {
    const text = str === null || str === undefined ? '' : String(str);
    return text
      .replace(/\\/g, '\\\\')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;')
      .replace(/\r\n|\r|\n/g, ' ')
      .slice(0, 500);
  }

  /**
   * Best-effort check that a string contains no leftover live-looking API
   * key/secret patterns. Used by the automated security regression test —
   * NOT a replacement for a server-side secret scanner.
   */
  const SECRET_PATTERNS = [
    /gsk_[A-Za-z0-9]{20,}/,       // Groq
    /sk-[A-Za-z0-9]{20,}/,        // OpenAI-style
    /AIza[0-9A-Za-z\-_]{30,}/,    // Google API key
    /xox[baprs]-[0-9A-Za-z-]{10,}/ // Slack tokens
  ];

  function containsLikelySecret(text) {
    if (typeof text !== 'string') return false;
    return SECRET_PATTERNS.some((re) => re.test(text));
  }

  return {
    MAX_INPUT_LENGTH,
    sanitizeInput,
    escapeHtml,
    escapeHtmlMultiline,
    escapeAttr,
    containsLikelySecret
  };
});
