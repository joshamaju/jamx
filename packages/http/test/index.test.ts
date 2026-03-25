import { it, assert } from "vitest";

import {
  chain,
  composeInterceptors,
  createFetchHandler,
  createMemoryCacheStore,
  decodeJson,
  empty,
  err,
  expectStatus,
  expectSuccessStatus,
  isErr,
  isOk,
  json,
  mapErr,
  mapOk,
  match,
  ok,
  text,
  withAuth,
  withCache,
  withHeaders,
  withRetry,
  withTimeout,
  OK as okStatuses,
} from "../src/index.js";

it("either helpers map and chain values", () => {
  assert.deepEqual(
    mapOk(ok(2), (value) => value * 2),
    ok(4),
  );
  assert.deepEqual(
    mapErr(err("bad"), (value) => `wrapped:${value}`),
    err("wrapped:bad"),
  );

  const chained = chain(ok(4), (value) =>
    value > 2 ? ok(`value:${value}`) : err("too-small"),
  );

  assert.deepEqual(chained, ok("value:4"));
  assert.equal(
    match(chained, {
      ok: (value) => value,
      err: () => "failed",
    }),
    "value:4",
  );
});

it("status helpers support exact code arrays and status classes", () => {
  const created = ok(new Response(null, { status: 201 }));
  const uncommon = ok(new Response(null, { status: 299 }));

  assert.equal(isOk(expectStatus(created, okStatuses)), true);
  assert.equal(isErr(expectStatus(uncommon, okStatuses)), true);
  assert.equal(isOk(expectSuccessStatus(uncommon)), true);
});

it("body helpers parse and decode payloads", async () => {
  const parsedText = await text(
    ok(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  assert.equal(isOk(parsedText) && parsedText.value.includes("Ada"), true);

  const parsedJson = await json(
    ok(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  assert.deepEqual(parsedJson, ok({ id: 1, name: "Ada" }));

  const decoded = await decodeJson(
    ok(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), {
        status: 200,
        headers: { "content-type": "application/json" },
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

  const emptyResponse = await empty(ok(new Response(null, { status: 204 })));
  assert.deepEqual(emptyResponse, ok(undefined));
});

it("header and auth middleware modify outgoing requests", async () => {
  const handler = composeInterceptors(
    withHeaders({ accept: "application/json" }),
    withAuth("demo-token"),
  )(
    createFetchHandler({
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        assert.equal(request.headers.get("accept"), "application/json");
        assert.equal(request.headers.get("authorization"), "Bearer demo-token");

        return new Response(null, { status: 200 });
      },
    }),
  );

  const result = await handler("https://example.com");
  assert.equal(isOk(result), true);
});

it("retry retries once and cache prevents duplicate GET fetches", async () => {
  const store = createMemoryCacheStore();
  let calls = 0;

  const handler = composeInterceptors(
    withCache({ store }),
    withRetry({ retries: 1 }),
  )(
    createFetchHandler({
      fetch: async () => {
        calls += 1;

        if (calls === 1) {
          return new Response("retry", { status: 503 });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    }),
  );

  const first = await handler("https://example.com/users");
  const second = await handler("https://example.com/users");

  assert.equal(isOk(first) && first.value.status === 200, true);
  assert.equal(isOk(second) && second.value.status === 200, true);
  assert.equal(calls, 2);
});

it("timeout middleware aborts slow requests", async () => {
  const handler = composeInterceptors(withTimeout(5))(
    createFetchHandler({
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        return new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      },
    }),
  );

  const result = await handler("https://example.com/slow");
  assert.equal(isErr(result), true);
});
