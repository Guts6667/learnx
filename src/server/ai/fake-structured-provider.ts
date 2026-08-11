import type {
  StructuredAiProvider,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from './structured-provider.js';

export class FakeStructuredAiProvider implements StructuredAiProvider {
  public readonly name = 'fake';
  public readonly requests: StructuredGenerationRequest<unknown>[] = [];

  public constructor(
    private readonly resolver: (
      request: StructuredGenerationRequest<unknown>,
    ) =>
      | StructuredGenerationResult<unknown>
      | Promise<StructuredGenerationResult<unknown>>,
  ) {}

  public async generate<Output>(
    request: StructuredGenerationRequest<Output>,
  ): Promise<StructuredGenerationResult<Output>> {
    this.requests.push(request as StructuredGenerationRequest<unknown>);
    return (await this.resolver(
      request as StructuredGenerationRequest<unknown>,
    )) as StructuredGenerationResult<Output>;
  }
}
