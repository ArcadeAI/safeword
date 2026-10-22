# Required exact-host authentication is externally blocked

Decision: obtain real isolated Claude2.1.170 execution without substituting a
newer host, contaminating the fixture with the normal profile, or exposing a
credential. The accepted execution plan requires isolated authenticated native
Claude controls before retiring its policy path. Cursor IDE also needs native
computer interaction; CLI receipts cannot substitute for IDE receipts.

Figure-it-out investigation domains and controlling questions:

- Authentication: can the exact binary authenticate inside the owned profile?
- Secret handling: can the intended child receive a scoped credential without
  reading/copying plaintext or bypassing the password manager?
- Proof fidelity: would a substitute still prove the accepted exact-host cases?

Observed now: exact Claude auth status reports loggedIn:false/authMethod:none.
The owned scoped op run process18965 remains waiting; its authenticated READY
probe output is still empty. The computer-use tool was checked again and
reports the Mac locked, automatic unlock failed, manual unlock required.
No second credential resolution process was started or secret value read.

Options considered:

1. Use the normal newer authenticated CLI/profile. Strongest convenience, but
   loses both exact-version and profile-isolation proof; cannot clear the cases.
2. Copy credentials or bypass device/password-manager approval. Does not satisfy
   the project's scoped secret-handling rules and does not resolve trust safely.
3. Retain the exact isolated fixture and wait for manual Mac/1Password unlock.
   Preserves proof fidelity; requires external state change. Chosen.

Primary authentication sources fetched this pass:
https://code.claude.com/docs/en/authentication documents existing login, browser
sign-in and ANTHROPIC_API_KEY. https://www.1password.dev/cli/app-integration
documents desktop unlock/authentication for CLI requests. Their current options
do not turn the observed locked desktop into an unattended authentication route.
The local exact binary's observed status controls this fixture; latest docs do
not establish exact-version native conformance.

Premortem: unlock alone may not approve the scoped credential request. After
unlock, inspect the same pending process and use the narrow op run route; then
prove real native guards/resources/continuation. Do not claim an authenticated
READY response itself proves enforcement. No full scenario/feature completion
or native evidence admission is recorded. Working tree checkpoint:a6c7b225d.
