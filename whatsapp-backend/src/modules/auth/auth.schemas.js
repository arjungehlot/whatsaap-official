import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("A valid email is required").transform((value) => value.toLowerCase()),
    password: z.string().min(6, "Password must be at least 6 characters"),
    company: z.string().trim().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("A valid email is required").transform((value) => value.toLowerCase()),
    password: z.string().min(1, "Password is required"),
  }),
});
