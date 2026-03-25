import { chain, type Either, err, isErr, ok } from "./either.js";

export interface DecodeError {
  message: string;
  cause?: unknown;
}

export type Decoder<TValue, TError extends DecodeError = DecodeError> = (
  input: unknown,
) => Either<TError, TValue>;

export const defineDecoder = <
  TValue,
  TDecodeError extends DecodeError = DecodeError,
>(
  decoder: Decoder<TValue, TDecodeError>,
): Decoder<TValue, TDecodeError> => decoder;

export class ParseError extends Error {
  name = "ParseError";
  readonly response: Response;
  readonly operation: "json" | "text" | "empty";

  constructor(
    response: Response,
    operation: "json" | "text" | "empty",
    cause?: unknown,
  ) {
    super(`Failed to parse response body as ${operation}.`, { cause });
    this.response = response;
    this.operation = operation;
  }
}

export const json = async <TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, unknown>> => {
  if (isErr(result)) return result;

  try {
    return ok(await result.value.json());
  } catch (cause) {
    return err(new ParseError(result.value, "json", cause));
  }
};

export const text = async <TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, string>> => {
  if (isErr(result)) return result;

  try {
    return ok(await result.value.text());
  } catch (cause) {
    return err(new ParseError(result.value, "text", cause));
  }
};

export const empty = async <TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, void>> => {
  if (isErr(result)) return result;

  try {
    const value = await result.value.text();
    return value.length === 0
      ? ok(undefined)
      : err(new ParseError(result.value, "empty"));
  } catch (cause) {
    return err(new ParseError(result.value, "empty", cause));
  }
};

export const decodeJson = async <
  TError,
  TValue,
  TDecodeError extends DecodeError = DecodeError,
>(
  result: Either<TError, Response>,
  decoder: Decoder<TValue, TDecodeError>,
): Promise<Either<TError | ParseError | TDecodeError, TValue>> => {
  const parsed = await json(result);
  return chain(parsed, decoder);
};
