interface ApiErrorResponse {
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

function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiClientError(
      'OFFLINE_REQUEST_NOT_ALLOWED',
      'LearnX nécessite une connexion internet pour accéder aux données privées.',
      0,
    );
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
  assertOnline();

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
