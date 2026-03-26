import { AnyEither } from "./types.js";

export type Right<T> = { ok: true; value: T };

export type Left<T> = { ok: false; error: T };

export type Either<E, A> = Right<A> | Left<E>;

export const ok = <T>(value: T): Right<T> => ({ ok: true, value });

export const err = <T>(error: T): Left<T> => ({ ok: false, error });

export function isOk<T extends AnyEither>(_: T): _ is Extract<T, Right<any>> {
  return _.ok;
}

export function isErr<T extends AnyEither>(_: T): _ is Extract<T, Left<any>> {
  return !_.ok;
}

type ErrorOf<TResult extends AnyEither> =
  TResult extends Left<infer TError> ? TError : never;

type ValueOf<TResult extends AnyEither> =
  TResult extends Right<infer TValue> ? TValue : never;

export function mapOk<TResult extends AnyEither, TValue>(
  result: TResult,
  mapper: (value: ValueOf<TResult>) => TValue,
): Either<ErrorOf<TResult>, TValue> {
  if (!result.ok) return result;
  return ok(mapper(result.value));
}

export function mapErr<TResult extends AnyEither, TError>(
  result: TResult,
  mapper: (error: ErrorOf<TResult>) => TError,
): Either<TError, ValueOf<TResult>> {
  if (!result.ok) return err(mapper(result.error));
  return result;
}

export function chain<TResult extends AnyEither, TNext extends AnyEither>(
  result: TResult,
  mapper: (value: ValueOf<TResult>) => TNext,
): Either<ErrorOf<TResult> | ErrorOf<TNext>, ValueOf<TNext>> {
  if (!result.ok) return result;
  return mapper(result.value);
}

export function match<TResult extends AnyEither, TOutput>(
  result: TResult,
  branches: {
    ok: (value: ValueOf<TResult>) => TOutput;
    err: (error: ErrorOf<TResult>) => TOutput;
  },
): TOutput {
  if (!result.ok) return branches.err(result.error);
  return branches.ok(result.value);
}
