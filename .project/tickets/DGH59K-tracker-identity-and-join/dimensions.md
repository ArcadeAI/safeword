# Testing Dimensions — tracker-identity-and-join

The variables the scenarios must cover. Each row is a dimension; scenarios pick combinations
(happy path + the boundaries that change behavior).

| Dimension              | Values                                              | Why it matters / behavior change |
| ---------------------- | --------------------------------------------------- | -------------------------------- |
| Provider               | `none` · `github` · `linear`                        | `none` = today's local-id path (must be unchanged); github/linear = issue-first |
| Tracker reachability   | reachable · unreachable · auth-fail                 | unreachable/auth-fail must fail loud with no orphan folder |
| Create state           | fresh · partial-create (pending) · already-exists   | fresh mints; partial-create reconciles (no dup); already-exists adopts |
| Key shape              | GitHub `#123` / `owner/repo#123` · Linear `ENG-45`  | id adoption + folder keying must handle both shapes |
| Join lookup            | key→folder hit · miss (no folder) · stale map entry | hit resolves; miss = clean "not found", never crash |
| Secret source          | keychain · env · absent                             | absent → loud fail (no silent exit); never written to config/logs |
| Egress target          | private repo · public repo                          | public surfaces the existing egress warning |

## Coverage notes

- **Happy path:** provider=github, reachable, fresh, key `#123`, keychain → issue minted, folder
  keyed, join hit.
- **Must-cover boundaries:** unreachable→no orphan; partial-create→reconcile (no dup);
  provider=none→unchanged-path characterization test; join miss→clean not-found.
- **Inherited / not re-tested here:** the tracker write payload allow-list (epic TB1.AC5 child) and
  secret-store mechanics (existing `tracker-connect`/`secrets.ts`) — referenced, not duplicated.
