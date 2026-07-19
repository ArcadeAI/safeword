# Task

Build a scheduled-email feature for a web app.

Users should be able to schedule an email — a subject, a body, and a list of recipients —
to be sent at a chosen future time. Provide the HTTP endpoints and the sending logic.

- **User:** a non-technical end-user, working from the web UI.
- **Stack:** TypeScript. A single module plus route handlers is fine.
- Keep it focused; you don't need a database or a real email provider — an in-memory store
  and a `send(email)` function you can call are enough.

Write the implementation.
