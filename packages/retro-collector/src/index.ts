export interface PublicRetroCollectorRuntime {
  url: string;
  close: () => Promise<void>;
}

export interface PublicRetroCollectorOptions {
  databasePath: string;
}

export function startPublicRetroCollector(
  _options: PublicRetroCollectorOptions,
): Promise<PublicRetroCollectorRuntime> {
  throw new Error('Public retro collector is not implemented.');
}
