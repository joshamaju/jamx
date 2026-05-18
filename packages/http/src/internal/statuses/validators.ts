import { type Either, err, isErr } from "../either.js";

export class StatusError extends Error {
  name = "StatusError";
  readonly status: number;
  readonly statusText: string;
  readonly response: Response;
  readonly expected: number | readonly number[] | string;

  constructor(
    response: Response,
    expected: number | readonly number[] | string,
    message = `Unexpected HTTP status ${response.status}.`,
  ) {
    super(message);
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
    this.expected = expected;
  }
}

/**
 * Asserts that a response matches an expected status code or one of several
 * exact status codes.
 *
 * @example
 * ```ts
 * import { expectStatus, ok } from "@jamx/http";
 *
 * const result = expectStatus(ok(new Response(null, { status: 200 })), 200);
 * ```
 */
export function expectStatus<TError>(
  result: Either<TError, Response>,
  expected: number | readonly number[],
): Either<TError | StatusError, Response> {
  if (isErr(result)) return result;

  const matches = Array.isArray(expected)
    ? expected.includes(result.value.status)
    : result.value.status === expected;

  return matches
    ? result
    : err(
        new StatusError(
          result.value,
          expected,
          `Expected status ${formatExpectedStatus(expected)} but received ${result.value.status}.`,
        ),
      );
}

/**
 * Asserts that a response status satisfies a custom predicate.
 *
 * @example
 * ```ts
 * import { expectStatusRange, ok } from "@jamx/http";
 *
 * const result = expectStatusRange(
 *   ok(new Response(null, { status: 204 })),
 *   (status) => status >= 200 && status < 300,
 *   "a successful status (2xx)",
 * );
 * ```
 */
export function expectStatusRange<TError>(
  result: Either<TError, Response>,
  predicate: (status: number) => boolean,
  description = "a matching status",
): Either<TError | StatusError, Response> {
  if (isErr(result)) return result;

  return predicate(result.value.status)
    ? result
    : err(
        new StatusError(
          result.value,
          description,
          `Expected ${description} but received ${result.value.status}.`,
        ),
      );
}

export function isInformationalStatus(status: number) {
  return status >= 100 && status < 200;
}

export function isOkStatus(status: number) {
  return status >= 200 && status < 300;
}

export function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

export function isClientErrorStatus(status: number) {
  return status >= 400 && status < 500;
}

export function isServerErrorStatus(status: number) {
  return status >= 500 && status < 600;
}

export function isErrorStatus(status: number) {
  return isClientErrorStatus(status) || isServerErrorStatus(status);
}

export function expectInformationalStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(
    result,
    isInformationalStatus,
    "an informational status (1xx)",
  );
}

/**
 * Asserts that a response has a successful `2xx` status.
 *
 * @example
 * ```ts
 * import { expectOKStatus, ok } from "@jamx/http";
 *
 * const result = expectOKStatus(ok(new Response(null, { status: 204 })));
 * ```
 */
export function expectOKStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(result, isOkStatus, "a successful status (2xx)");
}

export function expectRedirectStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(result, isRedirectStatus, "a redirect status (3xx)");
}

export function expectClientErrorStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(
    result,
    isClientErrorStatus,
    "a client error status (4xx)",
  );
}

export function expectServerErrorStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(
    result,
    isServerErrorStatus,
    "a server error status (5xx)",
  );
}

export function expectErrorStatus<TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> {
  return expectStatusRange(
    result,
    isErrorStatus,
    "an error status (4xx or 5xx)",
  );
}

function formatExpectedStatus(expected: number | readonly number[]): string {
  return Array.isArray(expected) ? expected.join(", ") : String(expected);
}
