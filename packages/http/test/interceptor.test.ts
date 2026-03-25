import { assert, describe, expect, it } from "vitest";

import {
  composeInterceptors,
  createFetchHandler,
  createMemoryCacheStore,
  defineInterceptor,
  isErr,
  isOk,
  TimeoutError,
  withAuth,
  withCache,
  withHeaders,
  withRetry,
  withTimeout,
} from "../src/index.js";

describe("request middleware", () => {
  it("adds request headers", async () => {
    const handler = composeInterceptors(
      withHeaders({ accept: "application/json" }),
    )(
      createFetchHandler({
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input);

          assert.equal(request.headers.get("accept"), "application/json");

          return new Response(null, { status: 200 });
        },
      }),
    );

    const result = await handler("https://example.com");

    assert.equal(isOk(result), true);
  });

  it("adds auth headers", async () => {
    const handler = composeInterceptors(withAuth("demo-token"))(
      createFetchHandler({
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input);

          assert.equal(
            request.headers.get("authorization"),
            "Bearer demo-token",
          );

          return new Response(null, { status: 200 });
        },
      }),
    );

    const result = await handler("https://example.com");
    assert.equal(isOk(result), true);
  });
});

describe("retry middleware", () => {
  it("retries failed idempotent requests", async () => {
    let calls = 0;
    let spyCalls = 0;

    const spy = defineInterceptor(({ next }) => {
      spyCalls += 1;
      return next();
    });

    const handler = composeInterceptors(
      withRetry({ retries: 3 }),
      spy,
    )(
      createFetchHandler({
        fetch: async () => {
          calls += 1;

          if (calls < 3) {
            return new Response("retry", { status: 503 });
          }

          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }),
    );

    const result = await handler("https://example.com/users");

    assert.equal(isOk(result) && result.value.status === 200, true);
    assert.equal(spyCalls, 3);
    assert.equal(calls, 3);
  });

  it("does not replay non-idempotent requests by default", async () => {
    let calls = 0;

    const handler = composeInterceptors(withRetry({ retries: 2 }))(
      createFetchHandler({
        fetch: async () => {
          calls += 1;
          return new Response("failed", { status: 503 });
        },
      }),
    );

    const result = await handler("https://example.com/users", {
      method: "POST",
    });

    assert.equal(isOk(result) && result.value.status === 503, true);
    assert.equal(calls, 1);
  });
});

describe("cache middleware", () => {
  it("prevents duplicate GET fetches", async () => {
    const store = createMemoryCacheStore();
    let calls = 0;

    const handler = composeInterceptors(withCache({ store }))(
      createFetchHandler({
        fetch: async () => {
          calls += 1;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }),
    );

    const first = await handler("https://example.com/users");
    const second = await handler("https://example.com/users");

    assert.equal(isOk(first) && first.value.status === 200, true);
    assert.equal(isOk(second) && second.value.status === 200, true);
    assert.equal(calls, 1);
  });

  it("varies cache keys by request headers", async () => {
    const store = createMemoryCacheStore();
    let calls = 0;
    let token = "first-token";

    const handler = composeInterceptors(
      withAuth(() => token),
      withCache({ store }),
    )(
      createFetchHandler({
        fetch: async (input) => {
          calls += 1;
          const request = input instanceof Request ? input : new Request(input);

          return new Response(request.headers.get("authorization"), {
            status: 200,
          });
        },
      }),
    );

    const first = await handler("https://example.com/users");
    token = "second-token";
    const second = await handler("https://example.com/users");
    const third = await handler("https://example.com/users");

    assert.equal(
      isOk(first) && (await first.value.text()) === "Bearer first-token",
      true,
    );
    assert.equal(
      isOk(second) && (await second.value.text()) === "Bearer second-token",
      true,
    );
    assert.equal(
      isOk(third) && (await third.value.text()) === "Bearer second-token",
      true,
    );
    assert.equal(calls, 2);
  });
});

describe("timeout middleware", () => {
  it("aborts slow requests", async () => {
    const handler = composeInterceptors(withTimeout(5))(
      createFetchHandler({
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input);

          return new Promise<Response>((_resolve, reject) => {
            request.signal.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          });
        },
      }),
    );

    const result = await handler("https://example.com/slow");
    assert.equal(isErr(result), true);

    if (!isErr(result)) {
      throw new Error("Expected timeout request to fail.");
    }

    if (!(result.error instanceof TimeoutError)) {
      throw new Error("Expected timeout error.");
    }

    assert.equal(result.error.timeoutMs, 5);
  });
});
