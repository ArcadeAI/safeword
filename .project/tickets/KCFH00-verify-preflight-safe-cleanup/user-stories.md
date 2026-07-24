# User stories: Keep verification preflight runnable in restricted agent shells

## Story: Run verification despite a restrictive shell policy

As an agent developer working in a restricted shell,
I want the verification skill to clean up its disposable Git probe without a blocked command form,
so that verification reaches the generated project checks while still distinguishing environment limits from product failures.

### Acceptance criteria

- The temporary Git-repository preflight remains in every shipped verify skill surface.
- Cleanup is depth-first, targets only the `mktemp` directory, and uses no `rm -rf` form.
- A regression test rejects the blocked cleanup form and requires the safe replacement across template and dogfood surfaces.
- The generated Codex plugin remains the canonical transformation of the template skill.
