import assert from "node:assert/strict";
import { test } from "node:test";
import { createTutorHandler } from "../apps/web/api/tutor.mjs";

const origin = "https://educloud.example";
const input = {
  question: "¿Qué ocurre si aumenta la resistencia?",
  source: true,
  allowGeneral: false,
};
function request(body = input, from = origin) {
  return new Request(origin + "/api/tutor", {
    method: "POST",
    headers: { Origin: from, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function choice(quote) {
  return Response.json({
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({ text: "Disminuye la corriente.", quote }),
        },
      },
    ],
  });
}

test("only forwards requests from EduCloud with a bounded question and the tutor enabled", async () => {
  const requestUpstream = () => assert.fail("Invalid request reached DeepSeek");
  const tutor = createTutorHandler({
    enabled: true,
    key: "test",
    requestUpstream,
  });
  const disabled = createTutorHandler({
    enabled: false,
    key: "test",
    requestUpstream,
  });
  assert.equal((await disabled(request())).status, 503);
  assert.equal(
    (await tutor(request(input, "https://other.example"))).status,
    403,
  );
  assert.equal(
    (await tutor(request({ ...input, question: "x".repeat(10000) }))).status,
    400,
  );
  assert.equal(
    (await tutor(request({ ...input, question: "x".repeat(481) }))).status,
    422,
  );
});

test("the anchored mode returns a citation only for a verbatim fragment", async () => {
  const quote =
    "Si el voltaje permanece fijo y aumenta la resistencia, la corriente disminuye.";
  const requestUpstream = async (url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test");
    assert.equal(payload.messages[1].content, input.question);
    assert.equal(payload.max_tokens, 350);
    assert.match(payload.messages[0].content, /12 V y 6 Ω/);
    return choice(quote);
  };
  const tutor = createTutorHandler({
    enabled: true,
    key: "test",
    requestUpstream,
  });
  assert.deepEqual(await (await tutor(request())).json(), {
    text: "Disminuye la corriente.",
    cited: true,
    quote,
    needsConsent: false,
  });
  const unsupported = createTutorHandler({
    enabled: true,
    key: "test",
    requestUpstream: async () => choice("Una cita inventada"),
  });
  assert.deepEqual(await (await unsupported(request())).json(), {
    text: "",
    cited: false,
    needsConsent: true,
  });
});

test("a one-click request generates a bounded Ohm challenge from the fixed note", async () => {
  const resource = {
    title: "Un motor en el taller",
    scenario: "Ajusta la corriente que recibe un motor de prueba.",
    voltage: 12,
    targetResistance: 4,
  };
  const tutor = createTutorHandler({
    enabled: true,
    key: "test",
    requestUpstream: async (_url, options) => {
      const { messages, max_tokens: maxTokens } = JSON.parse(options.body);
      assert.match(messages[0].content, /I = V \/ R/);
      assert.equal(maxTokens, 250);
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(resource) },
          },
        ],
      });
    },
  });
  const body = { action: "create-ohm-challenge" };
  assert.equal(
    (await tutor(request({ ...body, prompt: "un prompt" }))).status,
    422,
  );
  const response = await tutor(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), resource);
  resource.targetResistance = 0;
  assert.equal((await tutor(request(body))).status, 502);
});
