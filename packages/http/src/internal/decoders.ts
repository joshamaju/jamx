import type { StandardSchemaV1 } from "@standard-schema/spec";
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

export class SchemaError extends Error {
  name = "SchemaError";
  readonly vendor: string;
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(
    vendor: string,
    issues: ReadonlyArray<StandardSchemaV1.Issue>,
    cause?: unknown,
  ) {
    super(formatSchemaIssues(issues), { cause });
    this.vendor = vendor;
    this.issues = issues;
  }
}

export const validate = <
  TError,
  TDecodedValue,
  TSchema extends StandardSchemaV1<TDecodedValue, any>,
>(
  result: Either<TError, TDecodedValue>,
  schema: TSchema,
): Promise<Either<TError | SchemaError, StandardSchemaV1.InferOutput<TSchema>>> =>
  (async () => {
  if (isErr(result)) {
    return result;
  }

  const validated = await schema["~standard"].validate(result.value);

  if (validated.issues) {
    return err(
      new SchemaError(schema["~standard"].vendor, validated.issues, validated),
    );
  }

  return ok(validated.value);
})();

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

type ResponseInput<TError = never> = Response | Either<TError, Response>;

export function json(
  response: Response,
): Promise<Either<ParseError, unknown>>;
export function json<TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, unknown>>;
export async function json<TError>(
  input: ResponseInput<TError>,
): Promise<Either<TError | ParseError, unknown>> {
  const result = toResponseEither(input);

  if (isErr(result)) return result;

  try {
    return ok(await result.value.json());
  } catch (cause) {
    return err(new ParseError(result.value, "json", cause));
  }
}

export function text(
  response: Response,
): Promise<Either<ParseError, string>>;
export function text<TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, string>>;
export async function text<TError>(
  input: ResponseInput<TError>,
): Promise<Either<TError | ParseError, string>> {
  const result = toResponseEither(input);

  if (isErr(result)) return result;

  try {
    return ok(await result.value.text());
  } catch (cause) {
    return err(new ParseError(result.value, "text", cause));
  }
}

export function empty(
  response: Response,
): Promise<Either<ParseError, void>>;
export function empty<TError>(
  result: Either<TError, Response>,
): Promise<Either<TError | ParseError, void>>;
export async function empty<TError>(
  input: ResponseInput<TError>,
): Promise<Either<TError | ParseError, void>> {
  const result = toResponseEither(input);

  if (isErr(result)) return result;

  try {
    const value = await result.value.text();
    return value.length === 0
      ? ok(undefined)
      : err(new ParseError(result.value, "empty"));
  } catch (cause) {
    return err(new ParseError(result.value, "empty", cause));
  }
}

export function decodeJson<TValue, TDecodeError extends DecodeError = DecodeError>(
  response: Response,
  decoder: Decoder<TValue, TDecodeError>,
): Promise<Either<ParseError | TDecodeError, TValue>>;
export function decodeJson<
  TError,
  TValue,
  TDecodeError extends DecodeError = DecodeError,
>(
  result: Either<TError, Response>,
  decoder: Decoder<TValue, TDecodeError>,
): Promise<Either<TError | ParseError | TDecodeError, TValue>>;
export async function decodeJson<
  TError,
  TValue,
  TDecodeError extends DecodeError = DecodeError,
>(
  input: ResponseInput<TError>,
  decoder: Decoder<TValue, TDecodeError>,
): Promise<Either<TError | ParseError | TDecodeError, TValue>> {
  const parsed = await json(toResponseEither(input));
  return chain(parsed, decoder);
}

function toResponseEither<TError>(
  input: ResponseInput<TError>,
): Either<TError, Response> {
  return input instanceof Response ? ok(input) : input;
}

function formatSchemaIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  if (issues.length === 0) {
    return "Schema validation failed.";
  }

  return issues.map((issue) => issue.message).join("; ");
}
