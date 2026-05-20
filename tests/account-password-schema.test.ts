import assert from "node:assert/strict";
import { changePasswordSchema, passwordSchema } from "../src/lib/auth/password-schema";

function assertPasswordSuccess(password: string) {
  assert.equal(passwordSchema.safeParse(password).success, true);
}

function assertPasswordFailure(password: string) {
  assert.equal(passwordSchema.safeParse(password).success, false);
}

function assertChangePasswordSuccess(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  assert.equal(changePasswordSchema.safeParse(input).success, true);
}

function assertChangePasswordFailure(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  assert.equal(changePasswordSchema.safeParse(input).success, false);
}

async function main() {
  assertPasswordFailure("short1!");
  assertPasswordFailure("A".repeat(129));
  assertPasswordFailure("password日本語!");

  assertPasswordSuccess("Abc123!?");
  assertPasswordSuccess("A".repeat(128));

  assertChangePasswordSuccess({
    currentPassword: "oldPassword1!",
    newPassword: "newPassword1!",
    confirmPassword: "newPassword1!",
  });

  assertChangePasswordFailure({
    currentPassword: "oldPassword1!",
    newPassword: "newPassword1!",
    confirmPassword: "differentPassword1!",
  });
  assertChangePasswordFailure({
    currentPassword: "",
    newPassword: "newPassword1!",
    confirmPassword: "newPassword1!",
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
