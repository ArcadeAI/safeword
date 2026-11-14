export class ReviewPacketError extends Error {
  readonly name = 'ReviewPacketError';
  constructor(
    message: string,
    readonly code = 'REVIEW_PACKET_INVALID',
  ) {
    super(message);
  }
}
