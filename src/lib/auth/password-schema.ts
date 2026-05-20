import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "新パスワードは8文字以上で入力してください。")
  .max(128, "新パスワードは128文字以内で入力してください。")
  .regex(/^[\x21-\x7E]+$/, "新パスワードは半角英数字と記号だけで入力してください。");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "現在のパスワードを入力してください。"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "確認用パスワードを入力してください。"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "新パスワードと確認用パスワードが一致しません。",
  });
