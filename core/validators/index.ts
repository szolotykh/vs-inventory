export type { BaseValidator } from "./base.ts";
export { StringLengthValidator } from "./StringLengthValidator.ts";
export { SafeTextValidator } from "./SafeTextValidator.ts";
export { IntegerRangeValidator } from "./IntegerRangeValidator.ts";

/** Map of field name → validators to run. */
export type FieldSchema = Record<string, BaseValidator[]>;

export type ValidationFailure = { field: string; message: string };

export class ValidationError extends Error {
  constructor(public readonly failures: ValidationFailure[]) {
    super(failures.map((f) => `${f.field}: ${f.message}`).join("; "));
    this.name = "ValidationError";
  }
}

/**
 * Runs all validators in the schema against the provided data object.
 * Throws `ValidationError` if any field fails validation.
 */
export function validate(schema: FieldSchema, data: Record<string, unknown>): void {
  const failures: ValidationFailure[] = [];
  for (const [field, validators] of Object.entries(schema)) {
    const value = data[field];
    for (const validator of validators) {
      const message = validator.validate(value);
      if (message !== null) {
        failures.push({ field, message });
        break; // first failure per field is enough
      }
    }
  }
  if (failures.length > 0) throw new ValidationError(failures);
}
