export type Item = { id: string; name: string; description: string; count: number; categoryId?: string };

import { StringLengthValidator, SafeTextValidator, IntegerRangeValidator } from "../validators/index.ts";
import type { FieldSchema } from "../validators/index.ts";

export const itemCreateSchema: FieldSchema = {
  name: [new StringLengthValidator(1, 200, "name"), new SafeTextValidator("name")],
  description: [new StringLengthValidator(0, 1000, "description"), new SafeTextValidator("description")],
  count: [new IntegerRangeValidator(0, 1_000_000, "count")],
};

export const itemUpdateSchema: FieldSchema = {
  name: [new StringLengthValidator(1, 200, "name"), new SafeTextValidator("name")],
  description: [new StringLengthValidator(0, 1000, "description"), new SafeTextValidator("description")],
  count: [new IntegerRangeValidator(0, 1_000_000, "count")],
};
