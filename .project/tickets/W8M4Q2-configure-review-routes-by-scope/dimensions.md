# Dimensions: Configure review routes by scope

| Dimension        | Partitions and boundaries                                                       |
| ---------------- | ------------------------------------------------------------------------------- |
| Selected scope   | user; project                                                                   |
| Author ownership | same author at both scopes; only user; only project; project has another author |
| Mutation         | set; reset; read effective                                                      |
| Route model      | explicit model; runtime default                                                 |
| Existing content | unrelated keys; another author; empty routes object                             |
| Fallback         | selected scope; next scope; built-in legacy behavior                            |

An empty configured author route list is invalid and fails visibly rather than falling through to another scope. An empty routes object has no author entry and is equivalent to absence. Unsupported option syntax is covered by the shared CLI option parser; malformed persisted configuration is the representative file failure.

Mutation reads and writes only the selected scope; malformed configuration in a non-target scope is intentionally not consulted until effective routes are resolved.

The public CLI requires at least one `--route`, so an empty set request is rejected by the shared argument boundary before persistence. Generic filesystem permission failures are covered by the durable-write utility's existing contract rather than duplicated as route-preference acceptance behavior.
