/**
 * dsh-context7 — Context7 up-to-date library documentation tools for DSH.
 *
 * Registers two model tools backed by the Context7 Public API v2
 * (https://context7.com/api):
 *
 *   - context7_search    find libraries with indexed up-to-date docs
 *   - context7_get_docs  retrieve LLM-reranked docs / code snippets for a library
 *
 * Zero runtime dependencies: tool definitions are plain objects registered via
 * ctx.tools.register, and network uses the configured `web` seam when a fetch
 * provider is mounted, falling back to the in-process global fetch (Node >= 22).
 * No API key required (Context7 allows keyless access with low rate limits).
 */
export const name = 'dsh-context7'
export const inject = ['tools']

const BASE = 'https://context7.com/api'
const TIMEOUT_MS = 45000

function encode(v) {
  return encodeURIComponent(String(v))
}

function paramsToQuery(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => `${encode(k)}=${encode(params[k])}`)
    .join('&')
}

async function httpGet(ctx, path, params, exec) {
  const url = `${BASE}${path}?${paramsToQuery(params || {})}`
  // Preferred: the configured web seam (provider-aware fetching). Absent or
  // provider-less (throws), fall back to the in-process global fetch.
  const web = ctx.get('web')
  if (web !== undefined) {
    try {
      const res = await web.fetch({ url }, exec.signal)
      return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: (res.body && res.body.content) || '' }
    } catch (err) { /* fall through */ }
  }
  const signals = [AbortSignal.timeout(TIMEOUT_MS)]
  if (exec.signal) signals.push(exec.signal)
  const res = await fetch(url, { signal: AbortSignal.any(signals) })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error('context7: response is not JSON')
  }
}

function errorMessage(text) {
  try {
    const j = JSON.parse(text)
    return (j.error ? j.error + ': ' : '') + (j.message || text)
  } catch (err) {
    return text
  }
}

async function request(ctx, path, params, exec) {
  const res = await httpGet(ctx, path, params, exec)
  if (!res.ok) {
    const msg = errorMessage(res.text)
    if (res.status === 301) {
      let redirect = ''
      try { redirect = JSON.parse(res.text).redirectUrl || '' } catch (err) { /* ignore */ }
      throw new Error('context7: library redirected (301)' + (redirect ? ' -> ' + redirect : '') + ' — retry context7_get_docs with libraryId ' + (redirect || 'the new id'))
    }
    throw new Error('context7 API ' + path + ' failed with HTTP ' + res.status + ': ' + msg.slice(0, 400))
  }
  return parseJson(res.text)
}

async function resolveLibrary(ctx, library, query, exec) {
  if (typeof library === 'string' && library.startsWith('/')) return library
  const data = await request(ctx, '/v2/libs/search', { libraryName: library, query }, exec)
  const results = Array.isArray(data.results) ? data.results : []
  const pick = results.find((r) => r.state === 'finalized') || results[0]
  if (!pick) throw new Error('context7: no library found matching "' + library + '". Use context7_search to find the exact name.')
  return pick.id
}

function formatDocs(libraryId, query, data) {
  const md = []
  md.push('# Context7 documentation: ' + libraryId)
  md.push('')
  md.push('Query: ' + query)
  md.push('')
  const rules = data.rules || {}
  const ruleList = (rules.global || []).concat(rules.libraryOwn || [], rules.libraryTeam || [])
  if (ruleList.length) {
    md.push('## Rules')
    for (const r of ruleList) md.push('- ' + r)
    md.push('')
  }
  const codeSnippets = Array.isArray(data.codeSnippets) ? data.codeSnippets : []
  if (codeSnippets.length) {
    md.push('## Code snippets')
    md.push('')
    for (const s of codeSnippets) {
      md.push('### ' + (s.codeTitle || 'Snippet'))
      if (s.codeDescription) md.push(s.codeDescription)
      md.push('')
      const codeList = Array.isArray(s.codeList) ? s.codeList : []
      for (const c of codeList) {
        md.push('```' + (c.language || ''))
        md.push(c.code)
        md.push('```')
        md.push('')
      }
      if (s.codeId) { md.push('Source: ' + s.codeId); md.push('') }
    }
  }
  const infoSnippets = Array.isArray(data.infoSnippets) ? data.infoSnippets : []
  if (infoSnippets.length) {
    md.push('## Documentation snippets')
    md.push('')
    for (const s of infoSnippets) {
      md.push('### ' + (s.breadcrumb || s.pageId || 'Snippet'))
      md.push('')
      if (s.content) { md.push(s.content); md.push('') }
      if (s.pageId) { md.push('Source: ' + s.pageId); md.push('') }
    }
  }
  return md.join('\n')
}

function makeSearchTool(ctx) {
  return {
    name: 'context7_search',
    description: 'Search Context7 (context7.com) for software libraries with up-to-date indexed documentation. Returns ranked library matches with their Context7 library IDs (e.g. /vercel/next.js). Use this before context7_get_docs when you do not know the exact library ID, or to discover alternatives.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        libraryName: { type: 'string', description: 'Library name to search for, e.g. "fastapi", "next.js", "react".' },
        query: { type: 'string', description: 'Optional natural-language question or task used for intelligent relevance ranking, e.g. "how do I add middleware?".' },
        fast: { type: 'boolean', description: 'Skip LLM reranking for lower latency (default false).' },
      },
      required: ['libraryName'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                state: { type: 'string' },
                stars: { type: 'integer' },
                benchmarkScore: { type: 'number' },
                totalSnippets: { type: 'integer' },
                versions: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'title'],
            },
          },
        },
        required: ['query', 'results'],
      },
      render: (args, value) => {
        if (!value.results.length) {
          return [{ type: 'text', text: 'Context7 found no libraries matching "' + args.libraryName + '".' }]
        }
        const lines = ['# Context7 search results for "' + args.libraryName + '"', '']
        value.results.forEach((r, i) => {
          lines.push((i + 1) + '. **' + r.title + '** — `' + r.id + '`')
          if (r.description) lines.push('   ' + r.description)
          const meta = []
          if (r.state) meta.push('state: ' + r.state)
          if (r.stars) meta.push('stars: ' + r.stars)
          if (r.benchmarkScore) meta.push('benchmark: ' + r.benchmarkScore)
          if (r.totalSnippets) meta.push('snippets: ' + r.totalSnippets)
          if (meta.length) lines.push('   ' + meta.join(' · '))
          lines.push('')
        })
        lines.push('Pass the most relevant library ID to context7_get_docs.')
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: 30000,
    async execute(args, exec) {
      const data = await request(ctx, '/v2/libs/search', { libraryName: args.libraryName, query: args.query, fast: args.fast ? 'true' : undefined }, exec)
      const results = (Array.isArray(data.results) ? data.results : []).map((r) => ({
        id: String(r.id || ''),
        title: String(r.title || r.id || ''),
        description: r.description ? String(r.description) : undefined,
        state: r.state ? String(r.state) : undefined,
        stars: typeof r.stars === 'number' ? r.stars : undefined,
        benchmarkScore: typeof r.benchmarkScore === 'number' ? r.benchmarkScore : undefined,
        totalSnippets: typeof r.totalSnippets === 'number' ? r.totalSnippets : undefined,
        versions: Array.isArray(r.versions) ? r.versions.map(String) : undefined,
      }))
      return { query: args.libraryName, results }
    },
  }
}

function makeDocsTool(ctx) {
  return {
    name: 'context7_get_docs',
    description: 'Fetch up-to-date, LLM-reranked documentation context for one software library from Context7 (context7.com). Pass a library ID from context7_search (e.g. "/vercel/next.js") or a bare library name (auto-resolved). Returns the most relevant code snippets and documentation for your question, plus library rules and source URLs. Use whenever you need current API details for a library.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        library: { type: 'string', description: 'Context7 library ID (e.g. "/vercel/next.js", "/websites/uploadcare") or a bare library name such as "next.js" (auto-resolved via search).' },
        query: { type: 'string', description: 'Your natural-language question or task, e.g. "how do I implement authentication with middleware?".' },
        version: { type: 'string', description: 'Optional version tag to pin, e.g. "v15.1.8".' },
        fast: { type: 'boolean', description: 'Skip LLM reranking for lower latency (default false).' },
      },
      required: ['library', 'query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          libraryId: { type: 'string' },
          query: { type: 'string' },
          markdown: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['libraryId', 'query', 'markdown', 'sources'],
      },
      render: (args, value) => [{ type: 'text', text: value.markdown }],
    },
    timeoutMs: 60000,
    async execute(args, exec) {
      const libraryId = await resolveLibrary(ctx, args.library, args.query, exec)
      const params = {
        libraryId: args.version ? libraryId + '/' + args.version : libraryId,
        query: args.query,
        type: 'json',
        fast: args.fast ? 'true' : undefined,
      }
      const data = await request(ctx, '/v2/context', params, exec)
      const sources = []
      const codeSnippets = Array.isArray(data.codeSnippets) ? data.codeSnippets : []
      for (const s of codeSnippets) if (s.codeId) sources.push(String(s.codeId))
      const infoSnippets = Array.isArray(data.infoSnippets) ? data.infoSnippets : []
      for (const s of infoSnippets) if (s.pageId) sources.push(String(s.pageId))
      return {
        libraryId: params.libraryId,
        query: args.query,
        markdown: formatDocs(params.libraryId, args.query, data),
        sources: sources.filter((u, i) => sources.indexOf(u) === i),
      }
    },
  }
}

export function apply(ctx) {
  const sys = ctx.get('systemPrompt')
  if (sys !== undefined) {
    ctx.effect(() => sys.section({
      name: 'tool:context7',
      order: 115,
      text: 'Use the context7 tools (context7_search / context7_get_docs) to fetch up-to-date, version-specific documentation and code examples for software libraries from context7.com when you need current API details or patterns. Cite the returned source URLs.',
    }), 'dsh-context7: system prompt section')
  }
  ctx.effect(() => ctx.tools.register(makeSearchTool(ctx)), 'dsh-context7: context7_search')
  ctx.effect(() => ctx.tools.register(makeDocsTool(ctx)), 'dsh-context7: context7_get_docs')
}
