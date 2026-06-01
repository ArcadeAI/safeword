# Gherkin glossary

Shared definitions for terms used in Gherkin feature files and spec behaviors. All step
definitions must use vocabulary consistent with this document. `/review-spec` validates
that terms are used consistently.

When adding a term, use this format:

```markdown
## <Term>

**Definition:** Precise description of what this term means in the context of Arcade.
**Used in:** Which domains or services use this term.
**Example:** An example of correct usage in a Gherkin step.
**Do not confuse with:** Related terms that have distinct meanings.
```

Terms should represent domain concepts (e.g., "Organization", "Tool", "Project") and
recurring Gherkin step vocabulary (e.g., "valid request").

---

## Tool

**Definition:** A single callable capability exposed by Arcade — for example,
`GitHub.CreateIssue` or `Slack.SendMessage`. Each tool has a typed input schema,
executes a specific operation, and returns a structured result.

**Used in:** Engine (tool routing, execution via MCP servers), MCP servers (tool registration, implementation),
Dashboard (tool testing UI), all specs that describe tool invocation behavior.

**Example:** `When the agent calls the "GitHub.CreateIssue" tool with valid parameters`

**Do not confuse with:** Toolkit — a tool is a single operation; a toolkit is the collection
of related tools for one service. Do not confuse with MCP endpoint — a tool is the Arcade
abstraction; MCP is a transport protocol over which tools are served.

---

## Toolkit

**Definition:** A named collection of tools for a specific purpose or service, packaged as an MCP server. For example, the GitHub toolkit contains `GitHub.CreateIssue`,
`GitHub.ListPullRequests`, etc.

**Used in:** MCP server (toolkit host), Dashboard (toolkit management), Engine
(server routing configuration).

**Example:** `Given the GitHub toolkit (MCP server) is registered with the Engine`

**Do not confuse with:** Tool — the toolkit is the package; a tool is a single operation
within it. Do not confuse with MCP servers — toolkits are the logical grouping, servers are the physical host.

---

## Customer

**Definition:** A customer is a business entity that uses Arcade. A customer may have multiple organizations, but they are fully separate with nothing shared between them other than billing.

**Used in**: Coordinator (billing management), Dashboard (billing settings)

**Example**: `Given the customer is on a paid tier`

**Do not confuse with:** Organization — a customer is a business entity; an organization is a multi-tenancy boundary within a customer.

---

## Organization

**Definition:** The top-level multi-tenancy boundary in Arcade. All resources (projects,
users, servers, API keys, usage) belong to an organization. A customer may have multiple organizations, but they are fully separate with nothing shared between them other than billing.

**Used in:** Coordinator (org management, RBAC), Engine (multi-tenancy routing), Dashboard
(org settings), all specs involving access control or billing.

**Example:** `Given the organization has the "GitHub" toolkit enabled`

**Do not confuse with:** GitHub Organization (a different entity in a different system) or
Project (a sub-unit within an Arcade organization).

## Project

**Definition:** A project is a logical grouping of resources within an organization. Projects are used to isolate data and resources within an organization. For example, a project may be used to isolate data for environments (staging, production), teams, or products.

**Used in:** Coordinator (project management), Engine (project resources), Dashboard (project settings), all specs involving project-scoped resources.

**Example:** `Given an account belongs to a project`

**Do not confuse with:** Organization — a project is an isolation boundary within an organization; an organization is the top level isolation boundary.

---

## valid request

**Definition:** An API request that is syntactically correct, passes schema validation,
and includes required authentication credentials. A valid
request may still result in a domain-level error (e.g., rate limit exceeded) or an authorization (permissions) error,
but will not be rejected for malformed input or missing authentication.

**Used in:** Specs describing happy-path behaviors and error handling. Establishes the
baseline precondition before testing edge cases.

**Example:** `When a valid request is made to execute the "Slack.SendMessage" tool`

**Do not confuse with:** Authorized request — a valid request may return a domain error
(rate limit, permission denied). "Valid" refers to request structure and authentication, not
guaranteed success.

---

## authorized request

**Definition:** An API request that is syntactically correct, passes schema validation,
includes required authentication credentials, and is authorized to execute the requested operation.

**Used in:** Specs describing happy-path behaviors.

**Example:** `When a successful request is made to execute the "Slack.SendMessage" tool`

**Do not confuse with:** Valid request — a successful request is a valid request that is also authorized to execute the requested operation.
