import { z } from "zod";

export abstract class BaseTool {
  abstract name: string;
  abstract category: string;
  abstract description: string;
  requireUserApproval = false;
  abstract tags: string[];
  abstract whenToUse: string;
  abstract whenNotToUse: string;
  abstract schema: Record<string, z.ZodTypeAny>;
  abstract execute(args: any): Promise<object>;
}
