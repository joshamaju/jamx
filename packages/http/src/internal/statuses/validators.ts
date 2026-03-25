import { Either, err, isErr } from "../either.js";

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

export const expectStatus = <TError>(
  result: Either<TError, Response>,
  expected: number | readonly number[],
): Either<TError | StatusError, Response> => {
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
};

export const expectStatusRange = <TError>(
  result: Either<TError, Response>,
  predicate: (status: number) => boolean,
  description = "a matching status",
): Either<TError | StatusError, Response> => {
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
};

export const isInformationalStatus = (status: number) =>
  status >= 100 && status < 200;

export const isOkStatus = (status: number) => status >= 200 && status < 300;

export const isRedirectStatus = (status: number) =>
  status >= 300 && status < 400;

export const isClientErrorStatus = (status: number) =>
  status >= 400 && status < 500;

export const isServerErrorStatus = (status: number) =>
  status >= 500 && status < 600;

export const isErrorStatus = (status: number) =>
  isClientErrorStatus(status) || isServerErrorStatus(status);

export const expectInformationalStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(
    result,
    isInformationalStatus,
    "an informational status (1xx)",
  );

export const expectOKStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(result, isOkStatus, "a successful status (2xx)");

export const expectRedirectStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(result, isRedirectStatus, "a redirect status (3xx)");

export const expectClientErrorStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(result, isClientErrorStatus, "a client error status (4xx)");

export const expectServerErrorStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(result, isServerErrorStatus, "a server error status (5xx)");

export const expectErrorStatus = <TError>(
  result: Either<TError, Response>,
): Either<TError | StatusError, Response> =>
  expectStatusRange(result, isErrorStatus, "an error status (4xx or 5xx)");

function formatExpectedStatus(expected: number | readonly number[]): string {
  return Array.isArray(expected) ? expected.join(", ") : String(expected);
}
