import type { BaseValidator } from "./base.ts";

export class IntegerRangeValidator implements BaseValidator {
  constructor(
    private readonly min: number,
    private readonly max: number,
    private readonly fieldName: string,
  ) {}

  validate(value: unknown): string | null {
    if (typeof value !== "number") return null;
    if (!Number.isInteger(value)) return `${this.fieldName} must be an integer`;
    if (value < this.min) return `${this.fieldName} must be at least ${this.min}`;
    if (value > this.max) return `${this.fieldName} must be at most ${this.max}`;
    return null;
  }
}
