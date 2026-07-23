# Test definitions — SQ5KFS

## Configuration-free Go formatting

- [x] RED: with `.safeword/.golangci.yml` absent, the real post-edit hook invokes
  a fake `bunx` upgrade command before it formats the edited Go file.
- [x] GREEN: with that config absent, the real post-edit hook formats the Go file
  and the fake `bunx` command is never invoked.
- [x] REFACTOR: retain the existing config-backed Go golden-path coverage and
  template-to-dogfood parity.
