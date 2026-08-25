/**
 * Security Utility Module
 * Includes XSS input sanitization and Rate Limiting helpers
 */

/**
 * Sanitize strings to prevent XSS script injection attacks
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Brute-Force Rate Limiter Class
 */
export class RateLimiter {
  constructor(maxAttempts = 5, cooldownSeconds = 300) {
    this.maxAttempts = maxAttempts;
    this.cooldownMs = cooldownSeconds * 1000;
  }

  getRecord() {
    const data = localStorage.getItem('gsco_login_attempts');
    if (!data) return { attempts: 0, lockoutUntil: 0 };
    try {
      return JSON.parse(data);
    } catch {
      return { attempts: 0, lockoutUntil: 0 };
    }
  }

  saveRecord(record) {
    localStorage.setItem('gsco_login_attempts', JSON.stringify(record));
  }

  recordFailedAttempt() {
    const record = this.getRecord();
    record.attempts += 1;
    if (record.attempts >= this.maxAttempts) {
      record.lockoutUntil = Date.now() + this.cooldownMs;
    }
    this.saveRecord(record);
    return record;
  }

  resetAttempts() {
    localStorage.removeItem('gsco_login_attempts');
  }

  isLockedOut() {
    const record = this.getRecord();
    if (record.lockoutUntil && Date.now() < record.lockoutUntil) {
      const remainingSecs = Math.ceil((record.lockoutUntil - Date.now()) / 1000);
      return { locked: true, remainingSecs };
    }
    if (record.lockoutUntil && Date.now() >= record.lockoutUntil) {
      this.resetAttempts();
    }
    return { locked: false, remainingSecs: 0 };
  }
}
