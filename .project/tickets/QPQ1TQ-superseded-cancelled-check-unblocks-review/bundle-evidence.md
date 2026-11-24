# Generated runtime evidence (QPQ1TQ)

```text
Bundle: plugin/runtime/cli.js @ b706be3b3 (regenerated) (check-generated-surfaces: all 5 current)
## cancelled lint from ANOTHER workflow (release.yml), later success from ci.yml
exit=0
{"kind":"receipt","status":"prerequisites_failed","runState":null,"perms":{"actions":"read","contents":"read","issues":"read","pullRequests":"read"}}
## cancelled lint from the SAME workflow (ci.yml), later success from ci.yml
exit=0
{"kind":"receipt","status":null,"runState":"failed","perms":{"actions":"read","contents":"read","issues":"read","pullRequests":"read"}}
Note: the second case reaching runState=failed means prerequisites passed and inspection proceeded to the model call, which fails here only because no OPENAI_API_KEY is set.
```
