import assert from "node:assert/strict";
import test from "node:test";
import { makeSignupService } from "./developer_signup.ts";

test("a rejected captcha stops account creation and returns a client error", async () => {
  let createCalls = 0;
  const api = {
    captchaVerify: async () => ({ accepted: false }),
    createUser: async () => {
      createCalls += 1;
      return { user_id: "unexpected" };
    }
  };
  const result = await makeSignupService(api)({ email: "creator@example.com", password: "long-enough-password", name: "Creator", captchaToken: "token", deviceFingerprint: "device-1" }, "127.0.0.1");
  assert.equal(result.status, 422);
  assert.equal(createCalls, 0);
});
