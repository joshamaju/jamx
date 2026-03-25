import {
  composeInterceptors,
  createFetchHandler,
  createMemoryCacheStore,
  decodeJson,
  defineInterceptor as defineCoreInterceptor,
  defineDecoder,
  err,
  expectStatus,
  match,
  ok,
  withAuth,
  withCache,
  withHeaders,
  withRetry,
  withTimeout,
  type Chain,
} from "../src/index.js";

class AuthError extends Error {
  readonly kind = "auth-error";

  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface User {
  id: number;
  name: string;
  tenant: string;
  intercepted: boolean;
}

const cache = createMemoryCacheStore();

const requireJson = async ({ request, next }: Chain) => {
  const acceptsJson = request.headers
    .get("accept")
    ?.includes("application/json");

  if (!acceptsJson) {
    return err(new AuthError("This example requires JSON."));
  }

  return next();
};

const annotateResponse = defineCoreInterceptor(async ({ next }) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const payloadResult = await result.value.text();

  const response = result.value;

  return ok(
    new Response(
      JSON.stringify({
        ...(JSON.parse(payloadResult) as Record<string, unknown>),
        intercepted: true,
      }),
      {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      },
    ),
  );
});

const decodeUser = defineDecoder<User>((input) => {
  if (
    typeof input === "object" &&
    input !== null &&
    "id" in input &&
    "name" in input &&
    "tenant" in input &&
    "intercepted" in input &&
    typeof input.id === "number" &&
    typeof input.name === "string" &&
    typeof input.tenant === "string" &&
    typeof input.intercepted === "boolean"
  ) {
    return ok({
      id: input.id,
      name: input.name,
      tenant: input.tenant,
      intercepted: input.intercepted,
    });
  }

  return err({
    message: "Response body did not match the expected user shape.",
    cause: input,
  });
});

const handler = composeInterceptors(
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
  withTimeout(250),
  withHeaders({ accept: "application/json" }),
  withAuth("demo-token"),
  requireJson,
  annotateResponse,
)(
  createFetchHandler({
    fetch: createMockFetch(),
  }),
);

async function runExample() {
  const firstResponse = await handler("https://api.example.com/users/42");
  const firstUser = await decodeJson(
    expectStatus(firstResponse, 200),
    decodeUser,
  );

  console.log(
    match(firstUser, {
      ok: (user) => `first user: ${user.name} (${user.tenant})`,
      err: (error) => `first request failed: ${getErrorMessage(error)}`,
    }),
  );

  const cachedResponse = await handler("https://api.example.com/users/42");
  const cachedUser = await decodeJson(
    expectStatus(cachedResponse, 200),
    decodeUser,
  );

  console.log(
    match(cachedUser, {
      ok: (user) => `cached user: ${user.name} intercepted=${user.intercepted}`,
      err: (error) => `cached request failed: ${getErrorMessage(error)}`,
    }),
  );
}

void runExample();

function createMockFetch(): typeof globalThis.fetch {
  let attempts = 0;

  return async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    attempts += 1;

    if (request.method === "GET" && attempts === 1) {
      return new Response(JSON.stringify({ retry: true }), { status: 503 });
    }

    if (request.method === "POST") {
      return new Response(
        JSON.stringify({
          id: 99,
          created: true,
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const tenant = new URL(request.url).searchParams.get("tenant") ?? "unknown";

    return new Response(
      JSON.stringify({
        id: 42,
        name: "Ada Lovelace",
        tenant,
        authorization: request.headers.get("authorization"),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unknown error";
}
