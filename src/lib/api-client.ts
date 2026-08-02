export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export class ApiClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function getError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as ApiErrorResponse;

    return new ApiClientError(
      body.error.code,
      body.error.message,
      response.status,
    );
  } catch {
    return new ApiClientError(
      'UNKNOWN_ERROR',
      'Une erreur inattendue est survenue.',
      response.status,
    );
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await getError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
