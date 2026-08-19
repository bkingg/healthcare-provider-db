import { z } from "zod";
import { optionalPositiveInt, optionalString, optionalUuid } from "./common";

export const createUserSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  name: optionalString,
  roleId: optionalUuid,
});

export const updateUserSchema = z.object({
  id: z.uuid(),
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
