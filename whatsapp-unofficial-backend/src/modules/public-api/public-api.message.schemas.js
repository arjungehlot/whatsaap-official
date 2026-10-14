import { z } from "zod";

export const messageBatchSchema = z.object({
  params: z.object({ batchId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid message batch id") }),
});
