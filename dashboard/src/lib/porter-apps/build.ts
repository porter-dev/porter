import path from "path";
import { z } from "zod";

import { buildpackSchema } from "main/home/app-dashboard/types/buildpack";

// buildValidator is used to validate inputs for build setting fields
export const buildValidator = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("pack"),
    context: z
      .string()
      .min(1)
      .default("./")
      .catch("./")
      .refine((s) => !path.isAbsolute(s), {
        message: "Context must be a relative path",
      }),
    buildpacks: z.array(buildpackSchema).default([]),
    builder: z.string(),
  }),
  z.object({
    method: z.literal("docker"),
    context: z
      .string()
      .min(1)
      .default("./")
      .catch("./")
      .refine((s) => !path.isAbsolute(s), {
        message: "Context must be a relative path",
      }),
    dockerfile: z.string().min(1).default("./Dockerfile").catch("./Dockerfile"),
  }),
]);
export type BuildOptions = z.infer<typeof buildValidator>;
