# dsh-context7

Up-to-date library documentation for DeepSeek Harness, powered by [Context7](https://context7.com).

This host-only plugin connects DSH to the official Context7 Public API v2, so your agent can always fetch current, version-pinned documentation and code examples for software libraries. It registers two model tools:

| Tool | Purpose |
| --- | --- |
| `context7_search` | Search libraries by name (optionally with a natural-language question for LLM ranking). Returns matches with their Context7 library IDs (e.g. `/vercel/next.js`). |
| `context7_get_docs` | Fetch LLM-reranked documentation for one library by ID (or bare name, auto-resolved) plus a natural-language question: code snippets, doc snippets, library rules and source URLs. Supports `version` pinning (e.g. `v15.1.8`) and a `fast` low-latency mode. |

No API key is required — Context7 allows keyless access with low rate limits. For higher limits, get a `ctx7sk`-prefixed key from the [Context7 dashboard](https://context7.com/dashboard).

## Installing

From npm (published):

```bash
dsh plugin --profile web add dsh-context7
```

From GitHub:

```bash
dsh plugin --profile web add github:Nrxous/dsh-context7
```

Restart DSH after installing. The tools are called automatically whenever the model needs current library docs, or you can trigger them by asking directly.

## Configuring the API key (optional)

Set `config.apiKey` in your **profile patch layer** — `~/.dsh/profiles/<name>/cordis.patch.yml` — which is applied after every bundle layer and survives plugin updates:

```yaml
- id: dsh-context7
  config:
    apiKey: ctx7sk_your-key-here
```

Save and restart DSH. With a key set, requests carry an `Authorization: Bearer` header for higher rate limits. Without one, the plugin keeps working at keyless limits.

## Development

Pure JS plugin, no build step — `main: src/index.js`, runtime dependency `@deepseek-ai/schemastery` (provided by the host).

```bash
# Hot-mount into the web profile (no restart)
dev_install_package <this-directory>
# or inside the injector environment
dev_inject_plugin <this-directory>
```

## License

Apache-2.0
