export class RelayStore {
  static open(_databasePath: string): RelayStore {
    throw new Error('RelayStore is not implemented');
  }

  journalMode(): string {
    throw new Error('RelayStore is not implemented');
  }

  schemaVersion(): number {
    throw new Error('RelayStore is not implemented');
  }

  close(): void {
    throw new Error('RelayStore is not implemented');
  }
}
