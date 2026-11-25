import { z } from "zod";

export const SignInSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
});

export type SignInInput = z.infer<typeof SignInSchema>;
