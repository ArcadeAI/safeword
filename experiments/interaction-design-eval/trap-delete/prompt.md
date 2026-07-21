# Task (second trap — differently shaped: synchronous + irreversible)

Build a bulk-delete feature for a web app.

An admin picks a filter (e.g. all records older than a date, or all with a given status) and the
feature deletes every record matching it. Provide the HTTP endpoints and the deletion logic.

- **User:** an admin, working from the web UI.
- **Stack:** TypeScript. A single module plus route handlers is fine.
- Keep it focused; an in-memory store of records is enough — no real database needed.

Write the implementation.
