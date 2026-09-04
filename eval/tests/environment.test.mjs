import test from "node:test";
import assert from "node:assert/strict";
import { childProcessEnv, providerEnvironment } from "../environment.mjs";

test("親セッションの CLAUDE 変数を落とし、プロバイダー選択は保持する", () => {
  const source = {
    PATH: "/bin",
    CLAUDE_CONFIG_DIR: "/parent/config",
    CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
    CLAUDE_CODE_USE_BEDROCK: "1",
    CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
    AWS_REGION: "ap-northeast-1",
    ANTHROPIC_API_KEY: "secret",
  };
  const env = childProcessEnv({ CLAUDE_CONFIG_DIR: "/eval/config" }, source);

  assert.equal(env.PATH, "/bin");
  assert.equal(env.CLAUDE_CONFIG_DIR, "/eval/config");
  assert.equal(env.CLAUDE_CODE_ENTRYPOINT, undefined);
  assert.equal(env.CLAUDE_CODE_USE_BEDROCK, "1");
  assert.equal(env.CLAUDE_CODE_SKIP_BEDROCK_AUTH, "1");
  assert.equal(env.AWS_REGION, "ap-northeast-1");
  assert.equal(env.ANTHROPIC_API_KEY, "secret");
});

test("実験条件にはプロバイダー設定を記録し、認証値を残さない", () => {
  const summary = providerEnvironment({
    CLAUDE_CODE_USE_BEDROCK: "1",
    AWS_PROFILE: "evaluation",
    ANTHROPIC_API_KEY: "must-not-leak",
    AWS_SECRET_ACCESS_KEY: "must-not-leak-either",
  });

  assert.deepEqual(summary.values, {
    CLAUDE_CODE_USE_BEDROCK: "1",
    AWS_PROFILE: "evaluation",
  });
  assert.deepEqual(summary.credentialPresence, {
    ANTHROPIC_API_KEY: true,
    AWS_SECRET_ACCESS_KEY: true,
  });
  assert.doesNotMatch(JSON.stringify(summary), /must-not-leak/);
});
