# Spec: Fresh safeword setup scaffolds .project/

> Child of epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md). This
> child implements **DEV1.AC1** (fresh install scaffolds `.project/`) plus the
> seamlessness guarantees around it (driver steer 2026-06-12: the experience
> must be seamless for the end developer in every starting state). Sibling
> 9MMWS7 owns legacy migration; TAGWZ8 (done) provides the resolver.

## Intent

`safeword setup` scaffolds the project namespace at the resolved root —
`.project/` for fresh repos — adopting an existing arcade `.project/` without
touching user content, and leaving legacy `.safeword-project/` installs
exactly as they are. The developer never sees two namespace directories and
never has a file clobbered.

## Personas

- **Technical Builder (TB)** — runs `safeword setup` on a fresh repo, an arcade repo, or an old safeword repo, and gets one correct namespace with zero questions asked.

## Jobs To Be Done

### setup-scaffolds-project-dir.DEV1 — Set up into the right namespace, whatever my repo looks like

**Persona:** Technical Builder (TB)

> When I run `safeword setup`, I want the namespace scaffolded at the right
> root for my repo's state — new, arcade, or legacy — so setup just works and
> I never end up with two namespace directories or clobbered files.

#### setup-scaffolds-project-dir.DEV1.AC1 — A fresh repo gets `.project/` with all namespace directories and starter files

#### setup-scaffolds-project-dir.DEV1.AC2 — A repo with an existing `.project/` is adopted: missing pieces are added, existing user files are never overwritten

#### setup-scaffolds-project-dir.DEV1.AC3 — A legacy-only repo keeps operating entirely in `.safeword-project/`; no `.project/` appears

#### setup-scaffolds-project-dir.DEV1.AC4 — Every lifecycle command (setup, upgrade, diff, reset) agrees on the same resolved root

## Outcomes

- Zero new-install support questions about "which directory" — one namespace, correctly placed, in all three starting states.
- Arcade + safeword repos share `.project/` from day one with no manual reconciliation.

## Open Questions

_None — design (context-carried root + planning-time path translation) settled at intake; epic decisions inherited._
