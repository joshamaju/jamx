// @ts-expect-error
import NodeXMLHttpRequest from "xhr2";
import {
  chain,
  composeInterceptors,
  createFetchHandler,
  createMemoryCacheStore,
  createXhrHandler,
  decodeJson,
  defineInterceptor as defineCoreInterceptor,
  defineDecoder,
  err,
  expectOKStatus,
  expectStatus,
  isErr,
  json,
  mapOk,
  match,
  ok,
  text,
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

const requireStatusOk = defineCoreInterceptor(async ({ next }) => {
  const response = await next();
  return expectOKStatus(response);
});

const annotateResponse = defineCoreInterceptor(async ({ next }) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const payloadResult = await text(result.value);

  if (!payloadResult.ok) {
    return payloadResult;
  }

  const response = result.value;

  return ok(
    new Response(
      JSON.stringify({
        ...(JSON.parse(payloadResult.value) as Record<string, unknown>),
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

const logRequestLifecycle = defineCoreInterceptor(async ({ request, next }) => {
  console.log(`before request: ${request.method} ${request.url}`);

  const result = await next();

  console.log(
    match(result, {
      ok: (response) => `after request: ${response.status} ${request.url}`,
      err: (error) => `after request error: ${getErrorMessage(error)}`,
    }),
  );

  return result;
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
  withTimeout(250),
  withHeaders({ accept: "application/json" }),
  withAuth("demo-token"),
  requireJson,
  withCache({ store: cache }),
  withRetry({ retries: 1 }),
  annotateResponse,
  requireStatusOk,
)(
  createFetchHandler({
    fetch: createMockFetch(),
  }),
);

type AxiosResponse<T = any> = {
  data: T;
  status: number;
  statusText: string;
};

type AxiosError = {
  config: Request;
  response: AxiosResponse;
};

const axiosDecoder = defineCoreInterceptor(async (ctx) => {
  const response = await ctx.next();

  if (response.ok) {
    const res = response.value;
    const data = await json(res);

    if (isErr(data)) {
      throw data.error;
    }

    const obj = {
      data: data.value,
      status: res.status,
      statusText: res.statusText,
    };

    return res.ok ? ok(obj) : err(obj);
  }

  return response;
});

const axios = composeInterceptors(
  withTimeout(250),
  withHeaders({ accept: "application/json" }),
  withRetry({ retries: 1 }),
  axiosDecoder,
)(
  createFetchHandler({
    fetch: createMockFetch(),
  }),
);

async function runExample() {
  const axiosResponse = await axios("https://api.example.com/users/42");

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

  await runXhrExample();
  await runComposedXhrExample();
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
      return new Response(JSON.stringify({ id: 99, created: true }), {
        headers: { "content-type": "application/json" },
        status: 201,
      });
    }

    const tenant = new URL(request.url).searchParams.get("tenant") ?? "unknown";

    return new Response(
      JSON.stringify({
        id: 42,
        tenant,
        name: "Ada Lovelace",
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

globalThis.XMLHttpRequest =
  NodeXMLHttpRequest as unknown as typeof XMLHttpRequest;

async function runXhrExample() {
  if (typeof XMLHttpRequest === "undefined") {
    console.log("xhr example skipped: XMLHttpRequest is not available");
    return;
  }

  const xhr = createXhrHandler();

  const result = await xhr("https://placehold.co/320x240/png", {
    observer(_requestObserver, responseObserver) {
      responseObserver.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const percent = ((event.loaded / (event.total ?? 1)) * 100).toFixed(0);
        console.log(`xhr download progress: ${percent}%`);
      };
    },
  });

  console.log(
    match(result, {
      ok: (response) => `xhr download status: ${response.status}`,
      err: (error) => `xhr request failed: ${getErrorMessage(error)}`,
    }),
  );
}

async function runComposedXhrExample() {
  if (typeof XMLHttpRequest === "undefined") {
    console.log(
      "composed xhr example skipped: XMLHttpRequest is not available",
    );
    return;
  }

  const xhr = composeInterceptors(
    logRequestLifecycle,
    withHeaders({ accept: "image/png" }),
    withTimeout(2_000),
  )(createXhrHandler());

  const result = await xhr("https://placehold.co/320x240/png", {
    observer(_requestObserver, responseObserver) {
      responseObserver.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const percent = ((event.loaded / (event.total ?? 1)) * 100).toFixed(0);
        console.log(`composed xhr progress: ${percent}%`);
      };
    },
  });

  console.log(
    match(result, {
      ok: (response) => `composed xhr status: ${response.status}`,
      err: (error) => `composed xhr failed: ${getErrorMessage(error)}`,
    }),
  );
}
