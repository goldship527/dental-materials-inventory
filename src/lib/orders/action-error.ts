import { z } from "zod";

export type OrderActionErrorState = {
  status: "error";
  message: string;
};

export class OrderBusinessError extends Error {}

export const unexpectedOrderActionMessage =
  "結果を確認できませんでした。入出庫履歴と最新の一覧を確認してから操作してください。";

export function toOrderActionError(error: unknown): OrderActionErrorState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  if (error instanceof OrderBusinessError) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: unexpectedOrderActionMessage,
  };
}
