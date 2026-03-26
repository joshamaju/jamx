import { assert, describe, it } from "vitest";
import { z } from "zod";

import {
  decodeJson,
  empty,
  err,
  isErr,
  isOk,
  json,
  ok,
  SchemaError,
  text,
  validate,
} from "../src/index.js";

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

describe("validator helpers", () => {
  it("validates values parsed with the text helper", async () => {
    const textSchema = z.string().min(3);
    const parsed = await text(new Response("Ada", { status: 200 }));

    const result = await validate(parsed, textSchema);

    assert.deepEqual(result, ok("Ada"));
  });

  it("validates values parsed with the json helper", async () => {
    const userSchema = z.object({ id: z.number(), name: z.string() });

    const parsed = await json(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const result = await validate(parsed, userSchema);

    assert.deepEqual(result, ok({ id: 1, name: "Ada" }));
  });

  it("validates decoded values against a standard schema", async () => {
    const userSchema = z.object({ id: z.number(), name: z.string() });

    const result = await validate(ok({ id: 1, name: "Ada" }), userSchema);

    assert.deepEqual(result, ok({ id: 1, name: "Ada" }));
  });

  it("returns schema issues when schema validation fails", async () => {
    const userSchema = z.object({ id: z.number(), name: z.string() });

    // @ts-expect-error
    const result = await validate(ok({ id: "bad" }), userSchema);

    assert.equal(isErr(result), true);

    if (!isErr(result)) {
      throw new Error("Expected schema validation to fail.");
    }

    if (!(result.error instanceof SchemaError)) {
      throw new Error("Expected a schema error.");
    }

    assert.equal(result.error.vendor, "zod");
    assert.equal(result.error.message.includes("Invalid input"), true);
    assert.equal(result.error.issues.length > 0, true);
  });

  it("preserves decoder errors before schema validation", async () => {
    const userSchema = z.object({ id: z.number(), name: z.string() });

    const result = await validate(err({ message: "bad-payload" }), userSchema);

    assert.deepEqual(result, err({ message: "bad-payload" }));
  });
});
