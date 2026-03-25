import { assert, describe, it } from "vitest";

import { decodeJson, empty, err, isOk, json, ok, text } from "../src/index.js";

describe("body helpers", () => {
  it("parses text from a plain response", async () => {
    const parsedText = await text(
      new Response("Ada Lovelace", { status: 200 }),
    );

    assert.deepEqual(parsedText, ok("Ada Lovelace"));
  });

  it("parses text bodies", async () => {
    const parsedText = await text(
      ok(
        new Response(JSON.stringify({ id: 1, name: "Ada" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
    );

    assert.equal(isOk(parsedText) && parsedText.value.includes("Ada"), true);
  });

  it("parses json from a plain response", async () => {
    const parsedJson = await json(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    assert.deepEqual(parsedJson, ok({ id: 1, name: "Ada" }));
  });

  it("parses json bodies", async () => {
    const parsedJson = await json(
      ok(
        new Response(JSON.stringify({ id: 1, name: "Ada" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
    );

    assert.deepEqual(parsedJson, ok({ id: 1, name: "Ada" }));
  });

  it("decodes plain responses", async () => {
    const decoded = await decodeJson(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
      (input) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "id" in input &&
          "name" in input &&
          typeof input.id === "number" &&
          typeof input.name === "string"
        ) {
          return ok({ id: input.id, name: input.name });
        }

        return err({ message: "bad-payload", cause: input });
      },
    );

    assert.deepEqual(decoded, ok({ id: 1, name: "Ada" }));
  });

  it("decodes parsed json payloads", async () => {
    const decoded = await decodeJson(
      ok(
        new Response(JSON.stringify({ id: 1, name: "Ada" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
      (input) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "id" in input &&
          "name" in input &&
          typeof input.id === "number" &&
          typeof input.name === "string"
        ) {
          return ok({ id: input.id, name: input.name });
        }

        return err({ message: "bad-payload", cause: input });
      },
    );

    assert.deepEqual(decoded, ok({ id: 1, name: "Ada" }));
  });

  it("accepts plain empty responses", async () => {
    const emptyResponse = await empty(new Response(null, { status: 204 }));

    assert.deepEqual(emptyResponse, ok(undefined));
  });

  it("accepts empty responses", async () => {
    const emptyResponse = await empty(ok(new Response(null, { status: 204 })));

    assert.deepEqual(emptyResponse, ok(undefined));
  });
});
