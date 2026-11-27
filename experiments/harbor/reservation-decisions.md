# Reservation pilot decision log

The user receives each agent's actual question. Answers are recorded verbatim
with the arm and checkpoint, then sent to the same trial. A terminal response
is not a request for human input.

## Reply policy for future runs

Accept routine approval requests within the agreed scope and record the
reply as scripted. Use the answers below for actual decisions they cover.
Relay unresolved decisions to the user and record the answer and its scope
for future runs.

## Original interactive batch

Interactive batch: 2026-11-19, checkout `72165cde6`, release `1.1.0`.

## release, checkpoint 1

> Based on the BDD intake process, I need to discover the full context. Let me propose the **Product Plan** first with what I understand, then get your confirmation on the design.
>
> ## Product Plan: Reservation Feature
>
> **Product Bet:**
>
> - **Problem:** When items have limited stock, customers need to secure availability without immediate checkout, and duplicate requests shouldn't create multiple reservations.
> - **Expected outcome:** Customers can reserve available items; stock is reliably decremented on success; retries are idempotent and don't double-reserve.
> - **Success threshold:** Reservations succeed when stock > 0, fail when stock = 0 without changing inventory, and identical retry requests return the same reservation without creating a duplicate.
> - **Non-goals:** Payment processing, timing constraints (hold duration), or access control.
> - **Reversibility:** This is a one-way data model change (adds reservation state/history).
>
> **Jobs To Be Done:**
>
> 1. **Retail Customer** — When I want to secure an item with limited stock, I want to reserve it instantly, so I can lock in availability before checkout.
> 2. **System** — When a customer retries a failed or uncertain request, I want to detect the duplicate and return the existing reservation, so we don't oversell.
>
> **Shape:**
>
> - **M1 — Reservation Core:** Create reservation, check stock, handle stock exhaustion, detect and return existing reservations.
>
> **Killer Demo:** For a retail customer starting with a last-in-stock scenario, requesting a reservation produces an instant confirmation with decremented stock, and retrying the identical request returns the same reservation without creating a second one.
>
> **Surfaces:** Standalone Node.js service (API).
>
> ---
>
> **What I need from you:**
>
> 1. **Who reserves?** A customer ID, session ID, or some identifier to track "this is the same customer retrying"?
> 2. **Storage?** In-memory map, persistent DB, or just shape the code so storage is pluggable?
> 3. **API shape?** `POST /reservations { itemId, customerId, ...}` → `{ reservationId, itemId, status }`?
>
> **Confidence:** This is straightforward inventory logic, but I want to confirm the idempotency key and storage layer before we write scenarios.

Approved reply recorded below.

## checkout, checkpoint 1

> **CONFIDENT** — Build a reservation feature with BDD, starting with behavior scenarios that capture idempotency and inventory constraints.
>
> **Decided:** We'll use behavior-driven development (Gherkin scenarios) to define reservation behavior first, then implement the service and API layer. This touches multiple files (inventory, reservations, API) with new persistent state and multiple flows — a feature-sized scope.
>
> **Rejected:** Procedural specification without scenarios — BDD catches edge cases like idempotent retry upfront; building without it risks rework.
>
> **Open:** human: storage choice (in-memory or persistent database?); workflow surface (function/service, REST API, or both?); inventory model scope (pre-loaded stock, or model stock updates too?).
>
> **Next:** Reply with your preference on storage. I'll write the Gherkin scenarios to define the reservation behavior, then build the implementation to pass them.

Approved reply recorded below.

## Approved reply for both arms

> Use the existing `reserve(inventory, itemId, requestId)` function. The caller supplies the starting stock and reuses the same `requestId` when retrying. Keep reservation state in memory and limit the feature to that function. A retry must never reduce stock again.

Approved for reuse when a reservation trial asks about the interface, storage, starting stock, or retry identity. Provide it only after a relevant request for input.

Replacement checkout trial: approved reply delivered at checkpoint 1.

## Replacement checkout, checkpoint 2

Asked to confirm the return shape. The starter file already specifies
`{ status, inventory }` with status `reserved` or `sold-out`. Reply approved for reuse.

Replacement release trial: terminal handoff with no question or reply.

### Approved reusable return-shape reply

> Return `{ status, inventory }` as specified in `task.mjs`. Use `"reserved"` for a successful reservation and `"sold-out"` for unavailable stock.

Use only when the reservation agent asks about the return shape or sold-out status. This restates the starter contract. Keep it separate from the approved scope reply.

Approved return-shape reply delivered to the replacement checkout at checkpoint 2.

## Replacement checkout, checkpoint 3

The agent requested approval of the reservation Product Plan.

> Approved, proceed to scenarios.

Relay status: delivered. This approval applies to this Product Plan.

## Replacement checkout, checkpoint 4

The agent requested confirmation of the seven reservation scenarios before implementation.

> Approved, proceed to implementation.

Relay status: delivered. This approval applies to these scenarios.

Replacement checkout, checkpoint 5: terminal handoff after four requests and four replies.

## Retrying with stale caller inventory

If a reservation agent asks which inventory to return on a duplicate request, even when the caller supplies stale counts, use the approved reply below.

> Return the inventory supplied on retry, unchanged.

The retry never deducts stock again. This decision came from the third checkpoint of trial `reservation__aUPzxvb` on merged Safeword `649a98b80`.
