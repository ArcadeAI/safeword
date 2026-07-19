# Before you build: design the interaction

This feature lets a user hand off an action for the system to perform later, on its own,
while they're not watching. That hand-off opens gaps between the user and the system — design
to close them:

- **Evaluation** — can the user see what they've delegated and its current state?
- **Delegation / interrupt** — can the user bound and stop it before it acts (change or cancel
  a pending send)?
- **Delegation / recovery** — if it fails while acting unattended (a bad recipient, the provider
  errors, the job dies), does the user find out and does the system recover, rather than the
  send being silently lost?
- **Execution / confirmation** — can the user confirm intent before the action is committed, so
  a mistaken send is caught before it goes out?

Design so a non-technical end-user stays in control. Then build the feature.

---

(The task follows.)
