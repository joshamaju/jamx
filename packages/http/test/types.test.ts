import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  chain,
  composeInterceptors,
  createFetchHandler,
  createXhrHandler,
  defineInterceptor as defineCoreInterceptor,
  decodeJson,
  err,
  expectStatus,
  ok,
  text,
  validate,
  type Chain,
  type ComposeInterceptorsResult,
  type DecodeError,
  type ExecutableHandler,
  type FetchError,
  type ParseError,
  type ProgressRequestInit,
  type Result,
  type SchemaError,
  type StatusError,
  type TimeoutError,
  type XhrResult,
  withTimeout,
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

  const payloadResult = await text(result.value);

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

  const payloadResult = await text(result.value);

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
  it("exports the composed interceptor result type", () => {
    expectTypeOf<ComposeInterceptorsResult<[typeof plainAnnotate]>>().toEqualTypeOf<
      PlainHandlerResult
    >();
  });

  it("keeps plain and wrapped core interceptors equivalent", () => {
    expectTypeOf<PlainHandlerResult>().toEqualTypeOf<WrappedHandlerResult>();
    expectTypeOf<SuccessOf<WrappedHandlerResult>>().toEqualTypeOf<Response>();
    expectTypeOf<FetchError>().toMatchTypeOf<FailureOf<WrappedHandlerResult>>();
    expectTypeOf<ParseError>().toMatchTypeOf<FailureOf<WrappedHandlerResult>>();
  });

  it("adds status helper errors", () => {
    const statusChecked = expectStatus(
      ok(new Response(null, { status: 200 })),
      200,
    );

    expectTypeOf<SuccessOf<typeof statusChecked>>().toEqualTypeOf<Response>();

    expectTypeOf<StatusError>().toMatchTypeOf<
      FailureOf<typeof statusChecked>
    >();
  });

  it("adds decode helper errors", () => {
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

  it("accepts plain responses in decoder helpers", () => {
    const parsedText = text(new Response("Ada", { status: 200 }));

    const decoded = decodeJson(
      new Response(JSON.stringify({ id: 1, name: "Ada" }), { status: 200 }),
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

        return err<DecodeError>({ message: "invalid-user", cause: input });
      },
    );

    expectTypeOf<
      SuccessOf<Awaited<typeof parsedText>>
    >().toEqualTypeOf<string>();

    expectTypeOf<ParseError>().toMatchTypeOf<
      FailureOf<Awaited<typeof parsedText>>
    >();

    expectTypeOf<SuccessOf<Awaited<typeof decoded>>>().toEqualTypeOf<User>();

    expectTypeOf<ParseError>().toMatchTypeOf<
      FailureOf<Awaited<typeof decoded>>
    >();

    expectTypeOf<DecodeError>().toMatchTypeOf<
      FailureOf<Awaited<typeof decoded>>
    >();
  });

  it("infers validator output from standard schemas", () => {
    const userSchema = z
      .object({ id: z.number(), name: z.string() })
      .transform((value) => ({ ...value, active: true }));

    const validated = validate(ok({ id: 1, name: "Ada" }), userSchema);

    expectTypeOf<SuccessOf<Awaited<typeof validated>>>().toEqualTypeOf<
      User & { active: boolean }
    >({} as any);

    expectTypeOf<SchemaError>().toMatchTypeOf<
      FailureOf<Awaited<typeof validated>>
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

  it("preserves timeout-specific errors", () => {
    const timeoutHandler = composeInterceptors(withTimeout(5))(baseHandler);

    expectTypeOf<TimeoutError>().toMatchTypeOf<
      FailureOf<Awaited<ReturnType<typeof timeoutHandler>>>
    >();

    expectTypeOf<FetchError>().toMatchTypeOf<
      FailureOf<Awaited<ReturnType<typeof timeoutHandler>>>
    >();
  });

  it("preserves progress-aware init types through composition", () => {
    const xhrHandler = createXhrHandler();
    const composedXhrHandler = composeInterceptors(wrappedAnnotate)(xhrHandler);

    expectTypeOf(xhrHandler).toMatchTypeOf<
      ExecutableHandler<XhrResult, ProgressRequestInit>
    >();

    expectTypeOf<TimeoutError>().toMatchTypeOf<
      FailureOf<Awaited<ReturnType<typeof xhrHandler>>>
    >();

    expectTypeOf<FetchError>().toMatchTypeOf<
      FailureOf<Awaited<ReturnType<typeof xhrHandler>>>
    >();

    expectTypeOf(composedXhrHandler).toMatchTypeOf<
      ExecutableHandler<
        Awaited<ReturnType<typeof composedXhrHandler>>,
        ProgressRequestInit
      >
    >();
  });
});
