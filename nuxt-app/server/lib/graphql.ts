export class ProviderUnavailableError extends Error {
  readonly statusCode = 503;
  readonly statusMessage: string;

  constructor(provider: string, readonly retryAfterMs = 0) {
    super(`${provider} is temporarily unavailable. Please try again later.`);
    this.statusMessage = this.message;
  }
}

export class ProviderRequestError extends Error {}

export function retryAfterMs(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const delay = /^\d+$/.test(value.trim())
    ? Number(value) * 1000
    : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidationError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = isRecord(error.extensions) ? error.extensions.code : undefined;
  return code === "GRAPHQL_VALIDATION_FAILED" || code === "GRAPHQL_PARSE_FAILED" ||
    code === "BAD_USER_INPUT" || (typeof error.message === "string" &&
      /Cannot query field|Unknown argument|Syntax Error|Variable .+ (?:invalid|required)|does not exist in .+ enum/i.test(error.message));
}

export async function postGraphQL(
  endpoint: string,
  provider: string,
  query: string,
  variables: Record<string, unknown>,
  allowNotFound = false,
): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "GAQ-SRS/1.0 (personal AMQ study app)" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new ProviderUnavailableError(provider);
  }
  if (allowNotFound && response.status === 404) return null;
  if ([403, 429].includes(response.status) || response.status >= 500) {
    throw new ProviderUnavailableError(provider, response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : 0);
  }
  if (!response.ok) throw new ProviderRequestError(`${provider} rejected the request (${response.status}).`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProviderUnavailableError(provider);
  }
  if (!isRecord(body)) throw new ProviderUnavailableError(provider);
  if (body.errors != null && !Array.isArray(body.errors)) throw new ProviderUnavailableError(provider);
  if (Array.isArray(body.errors) && body.errors.length) {
    if (allowNotFound && body.errors.every((error) => isRecord(error) && error.status === 404)) return null;
    if (body.errors.some(isValidationError)) throw new ProviderRequestError(`${provider} rejected the GraphQL query.`);
    throw new ProviderUnavailableError(provider);
  }
  if (!isRecord(body.data)) throw new ProviderUnavailableError(provider);
  return body.data;
}
