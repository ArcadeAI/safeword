/**
 * The opt-in `setup` offer (2TK5AD AC1, AC8). A single yes/no (default no) that,
 * on accept, runs the *same* connect flow `safeword connect` runs — one code path,
 * so setup-connect and standalone-connect can't diverge. Declining is fully inert.
 */

import type { ConnectResult, ConnectTarget, Prompt } from './types.js';

export interface ConnectChoice {
  provider: string;
  target: ConnectTarget;
}

export interface OfferDependencies {
  prompt: Prompt;
  /** Obtain the provider+target to connect (prompt the human); undefined cancels. */
  chooseConnect: () => Promise<ConnectChoice | undefined>;
  /** Run the connect flow — the same orchestration `safeword connect` uses. */
  connect: (choice: ConnectChoice) => Promise<ConnectResult>;
}

export async function offerTrackerConnect(dependencies: OfferDependencies): Promise<void> {
  const accepted = await dependencies.prompt.confirm(
    'Connect a tracker (Linear/GitHub) to mirror tickets now?',
    false,
  );
  if (!accepted) return; // AC1 — declined leaves the project inert.
  const choice = await dependencies.chooseConnect();
  if (choice === undefined) return;
  await dependencies.connect(choice); // AC8 — delegate to the real connect flow.
}
