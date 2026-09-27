import { z } from "zod";
import { optionalPositiveInt, optionalString, optionalUuid } from "./common";
import { HANDLE_PATTERN, normalizeHandle } from "@/lib/handle";

const handle = z
  .string()
  .transform(normalizeHandle)
  .pipe(z.string().regex(HANDLE_PATTERN, "3–30 characters: letters, numbers, dots or underscores, starting and ending with a letter or number"));

export const createUserSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  handle,
  name: optionalString,
  roleId: optionalUuid,
});

export const updateUserSchema = z.object({
  id: z.uuid(),
  handle,
  name: optionalString,
  roleId: optionalUuid,
  maxSearchResults: optionalPositiveInt,
});

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
