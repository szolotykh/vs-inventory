export type Category = { id: string; name: string };

import { StringLengthValidator, SafeTextValidator } from "../validators/index.ts";
import type { FieldSchema } from "../validators/index.ts";

export const categorySchema: FieldSchema = {
  name: [new StringLengthValidator(1, 200, "name"), new SafeTextValidator("name")],
};
