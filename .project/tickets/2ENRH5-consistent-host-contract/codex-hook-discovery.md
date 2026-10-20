# Codex 0.160.0 hook-format investigation

## Question and investigation plan

Which native delivery preserves one authored content graph and real hooks on
the accepted Codex target, after portable registration exposes no hooks?

- Host API domain: inspect version-matched discovery and native hooks/list;
  distinguish missing hooks from untrusted hooks.
- Package ownership domain: compare a shared portable core plus hook companion
  with one compatibility container derived from the same content owner.
- Lifecycle and recovery domain: compare registration, activation, cleanup and
  duplicate-authority cost; preserve existing native behavior and trust.
- Standards domain: preserve portable skill content and truthful format claims;
  do not infer runtime support from current-format documentation.

## Reproduction and competing hypotheses

The accepted pinned binary reports codex-cli 0.160.0. A generated portable
pilot with root plugin.json and extensions.com.openai.hooks installs and loads
skills, but native hooks/list and the TUI /hooks show zero installed hooks.

Ruled out disabled hooks/plugins: native features list reports both enabled;
explicit feature enablement produces the same empty list. Ruled out missing
payload: hooks.json exists in the generated package and exact installed cache;
tree-byte comparison passes. Removing parent chat bridge environment variables
also leaves the same result. No hook trust was changed or bypassed.

The isolated comparison run codex-hook-format-tdZICY uses two fresh profiles
without copied authentication. Each receives the same generated package and
native marketplace installation; the compatibility control removes only root
plugin.json. Native hooks/list observes:

| Container | Installed hooks | Trust |
| --- | --- | --- |
| Portable root manifest | 0, no warning or error | None to review |
| Compatibility manifest | 5 expected events | All enabled and untrusted |

This is discovery evidence only. No hook executed and no action protection or
continuation was proved.

## Root cause

The version-tagged Codex loader explicitly returns empty hook sources for
PluginManifestFormat::AgentPlugin and calls load_plugin_hooks only for the
legacy format. The root manifest parser does preserve the inline hooks setting,
but the later loader discards hooks for that package format. Installing or
trusting the root package cannot repair that discovery branch.

Primary source fetched 2026-10-20:
https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core-plugins/src/loader.rs#L952-L963

Current OpenAI packaging guidance describes root-extension hooks, but it is not
proof that this pinned earlier binary implements them:
https://developers.openai.com/plugins/build/plugins

## Options under assessment

1. Keep portable root plus inline hook extension: fewest package identities, but
   incorrect for required enforcement on 0.160.0; rejected by source and native
   comparison.
2. Portable core plus compatibility hook companion: technically separates
   content and hooks, but adds a second native registration, package identity,
   activation and recovery dependency. No independent content authorship is
   necessary, but duplicated generated runtime dependencies remain.
3. Keep one native compatibility container on 0.160.0, deriving its skills and
   resources from the shared content graph. The manifest is a host projection;
   skill/resource authorship and policy stay shared. Preserve portable root
   loading as a separate capability proof, not selected enforcement evidence.

Recommend option 3: it preserves the current single registration and real hook
discovery without introducing a companion solely to retain a portable manifest.
Generated host container differences do not require equivalent content edits.
Root-format-only activation remains ineligible for required hook guarantees.

**Premortem:** a future Codex upgrade silently changes discovery or precedence;
keep format-specific native controls and require an explicit binding-policy
update before selecting a root-format enforcement mechanism.

**Next:** revise the affected implementation and execution decisions and obtain
fresh independent reviews before more production work.
