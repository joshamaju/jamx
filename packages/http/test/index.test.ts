import { assert, describe, it } from "vitest";

import {
  chain,
  createFetchHandler,
  defaultContext,
  defaultFetch,
  err,
  expectStatus,
  expectOKStatus,
  isErr,
  isOk,
  mapErr,
  mapOk,
  match,
  ok,
  OK as okStatuses,
} from "../src/index.js";

describe("createFetchHandler", () => {
  it("exports a default context backed by global fetch", () => {
    assert.equal(defaultContext.fetch, globalThis.fetch);
  });

  it("exports a default fetch handler backed by the default context", async () => {
    const result = await defaultFetch(
      new Request("data:application/json,%7B%22ok%22%3Atrue%7D"),
    );

    assert.equal(isOk(result), true);

    if (!isOk(result)) {
      throw new Error("Expected default fetch handler to return an ok result.");
    }

    assert.equal(result.value.status, 200);
  });

  it("wraps successful fetch responses", async () => {
    const fetch = createFetchHandler({
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        assert.equal(request.url, "https://example.com/users");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const result = await fetch(new Request("https://example.com/users"));

    assert.equal(isOk(result), true);

    if (!isOk(result)) {
      throw new Error("Expected fetch handler to return an ok result.");
    }

    assert.equal(result.value.status, 200);
  });
});

describe("either helpers", () => {
  it("maps ok values", () => {
    assert.deepEqual(
      mapOk(ok(2), (value) => value * 2),
      ok(4),
    );
  });

  it("maps err values", () => {
    assert.deepEqual(
      mapErr(err("bad"), (value) => `wrapped:${value}`),
      err("wrapped:bad"),
    );
  });

  it("chains ok values", () => {
    const chained = chain(ok(4), (value) =>
      value > 2 ? ok(`value:${value}`) : err("too-small"),
    );

    assert.deepEqual(chained, ok("value:4"));
  });

  it("matches either branches", () => {
    const chained = chain(ok(4), (value) =>
      value > 2 ? ok(`value:${value}`) : err("too-small"),
    );

    assert.equal(
      match(chained, {
        ok: (value) => value,
        err: () => "failed",
      }),
      "value:4",
    );
  });
});

describe("status helpers", () => {
  it("supports exact status code arrays", () => {
    const created = ok(new Response(null, { status: 201 }));
    const uncommon = ok(new Response(null, { status: 299 }));

    assert.equal(isOk(expectStatus(created, okStatuses)), true);
    assert.equal(isErr(expectStatus(uncommon, okStatuses)), true);
  });

  it("supports status class validators", () => {
    const uncommon = ok(new Response(null, { status: 299 }));

    assert.equal(isOk(expectOKStatus(uncommon)), true);
  });
});
