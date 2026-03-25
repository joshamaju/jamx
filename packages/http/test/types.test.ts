import { describe, expectTypeOf, it } from "vitest";

import {
  chain,
  composeInterceptors,
  createFetchHandler,
  defineInterceptor as defineCoreInterceptor,
  decodeJson,
  err,
  expectStatus,
  ok,
  text,
  type Chain,
  type DecodeError,
  type ExecutableHandler,
  type FetchError,
  type ParseError,
  type Result,
  type StatusError,
} from "../src/index.js";

type SuccessOf<T> = T extends { ok: true; value: infer TValue }
  ? TValue
  : never;

type FailureOf<T> = T extends { ok: false; error: infer TError }
  ? TError
  : never;

interface User {
  id: number;
  name: string;
}

const plainAnnotate = async ({ next }: Chain) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const payloadResult = await text(result);

  if (!payloadResult.ok) {
    return payloadResult;
  }

  return ok(new Response(payloadResult.value, { status: result.value.status }));
};

const wrappedAnnotate = defineCoreInterceptor(async ({ next }) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const payloadResult = await text(result);

  if (!payloadResult.ok) {
    return payloadResult;
  }

  return ok(new Response(payloadResult.value, { status: result.value.status }));
});

const baseHandler = createFetchHandler({
  fetch: async () =>
    new Response(JSON.stringify({ id: 1, name: "Ada" }), { status: 200 }),
});

const plainHandler = composeInterceptors(plainAnnotate)(baseHandler);
const wrappedHandler = composeInterceptors(wrappedAnnotate)(baseHandler);

type PlainHandlerResult = Awaited<ReturnType<typeof plainHandler>>;
type WrappedHandlerResult = Awaited<ReturnType<typeof wrappedHandler>>;

describe("type inference", () => {
  it("keeps plain and wrapped core interceptors equivalent", () => {
    expectTypeOf<PlainHandlerResult>().toEqualTypeOf<WrappedHandlerResult>();
    expectTypeOf<SuccessOf<WrappedHandlerResult>>().toEqualTypeOf<Response>();
    expectTypeOf<FetchError>().toMatchTypeOf<FailureOf<WrappedHandlerResult>>();
    expectTypeOf<ParseError>().toMatchTypeOf<FailureOf<WrappedHandlerResult>>();
  });

  it("accumulates status and decode helper errors", () => {
    const statusChecked = expectStatus(
      ok(new Response(null, { status: 200 })),
      200,
    );
    const decoded = decodeJson(statusChecked, (input) => {
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

      return err<DecodeError>({ message: "invalid-user", cause: input });
    });

    expectTypeOf<SuccessOf<typeof statusChecked>>().toEqualTypeOf<Response>();
    expectTypeOf<StatusError>().toMatchTypeOf<
      FailureOf<typeof statusChecked>
    >();
    expectTypeOf<SuccessOf<Awaited<typeof decoded>>>().toEqualTypeOf<User>();
    expectTypeOf<ParseError>().toMatchTypeOf<
      FailureOf<Awaited<typeof decoded>>
    >();
    expectTypeOf<StatusError>().toMatchTypeOf<
      FailureOf<Awaited<typeof decoded>>
    >();
    expectTypeOf<DecodeError>().toMatchTypeOf<
      FailureOf<Awaited<typeof decoded>>
    >();
  });

  it("keeps composed handlers executable", () => {
    const customInterceptorHandler = composeInterceptors(
      async ({ next }: Chain) => {
        const result = await next();

        return chain(result, (response) =>
          ok(
            new Response(response.body, {
              status: response.status,
              headers: response.headers,
            }),
          ),
        );
      },
    )(baseHandler);

    expectTypeOf(customInterceptorHandler).toMatchTypeOf<
      ExecutableHandler<Awaited<ReturnType<typeof customInterceptorHandler>>>
    >();
    expectTypeOf<
      Awaited<ReturnType<typeof customInterceptorHandler>>
    >().toMatchTypeOf<Result>();
  });
});
