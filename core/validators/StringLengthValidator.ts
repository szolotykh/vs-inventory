import type { BaseValidator } from "./base.ts";

export class StringLengthValidator implements BaseValidator {
  constructor(
    private readonly min: number,
    private readonly max: number,
    private readonly fieldName: string,
  ) {}

  validate(value: unknown): string | null {
    if (typeof value !== "string") return null; // type checking is a separate concern
    if (value.length < this.min) return `${this.fieldName} must be at least ${this.min} character(s)`;
    if (value.length > this.max) return `${this.fieldName} must be at most ${this.max} character(s)`;
    return null;
  }
}
