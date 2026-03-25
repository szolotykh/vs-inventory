import type { BaseValidator } from "./base.ts";

/** Rejects strings containing common injection patterns (HTML tags, SQL keywords, script injection). */
const UNSAFE_PATTERNS = [
  /<[^>]+>/,                          // HTML/XML tags
  /--|;|\bDROP\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bUNION\b/i, // SQL injection
  /javascript\s*:/i,                  // JavaScript protocol
  /on\w+\s*=/i,                       // Inline event handlers
];

export class SafeTextValidator implements BaseValidator {
  constructor(private readonly fieldName: string) {}

  validate(value: unknown): string | null {
    if (typeof value !== "string") return null;
    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.test(value)) return `${this.fieldName} contains invalid characters or patterns`;
    }
    return null;
  }
}
