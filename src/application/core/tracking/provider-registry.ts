import type { Format } from "../../../models/media.js";
import type { Provider } from "../../../models/provider.js";

export class ProviderNotRegisteredError extends Error {
  constructor(
    readonly format: Format,
    readonly providerId?: string,
  ) {
    super(
      providerId
        ? `Provider ${providerId} is not registered`
        : `No provider is registered for ${format}`,
    );
    this.name = "ProviderNotRegisteredError";
  }
}

export class ProviderRegistry {
  private readonly providersById = new Map<string, Provider>();
  private readonly providersByFormat = new Map<Format, Provider[]>();

  constructor(providers: Provider[]) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: Provider): void {
    if (this.providersById.has(provider.id)) {
      throw new Error(`Provider ${provider.id} is already registered`);
    }

    this.providersById.set(provider.id, provider);
    this.providersByFormat.set(provider.format, [
      ...(this.providersByFormat.get(provider.format) ?? []),
      provider,
    ]);
  }

  primaryFor(format: Format): Provider {
    const provider = this.providersByFormat.get(format)?.[0];
    if (!provider) throw new ProviderNotRegisteredError(format);
    return provider;
  }

  get(providerId: string, format: Format): Provider {
    const provider = this.providersById.get(providerId);
    if (!provider || provider.format !== format) {
      throw new ProviderNotRegisteredError(format, providerId);
    }
    return provider;
  }

  has(providerId: string, format: Format): boolean {
    const provider = this.providersById.get(providerId);
    return provider?.format === format;
  }

  list(): Provider[] {
    return [...this.providersById.values()];
  }

  listForFormat(format: Format): Provider[] {
    return [...(this.providersByFormat.get(format) ?? [])];
  }
}
