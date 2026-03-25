/** A single validation rule. Returns an error message string, or null if the value is valid. */
export interface BaseValidator {
  validate(value: unknown): string | null;
}
