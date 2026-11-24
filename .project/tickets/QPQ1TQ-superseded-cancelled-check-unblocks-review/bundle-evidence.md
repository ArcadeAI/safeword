# Generated runtime evidence (QPQ1TQ)

Bundle: plugin/runtime/cli.js at c323c97f6 (generated surfaces current).

```text
## cancelled lint run 11 from ANOTHER workflow (release.yml), later success run 12 from ci.yml
{"status":"prerequisites_failed","runState":null}
## cancelled lint run 11 from the SAME workflow (ci.yml), later success run 12
{"status":null,"runState":"failed"}
## cancelled lint run 13 from ci.yml is NEWER than the success run 12
{"status":"prerequisites_failed","runState":null}
```

prerequisites_failed = the cancellation still counts. runState failed with no status = prerequisites passed and inspection reached the model call, which fails here only because no OPENAI_API_KEY is set.
