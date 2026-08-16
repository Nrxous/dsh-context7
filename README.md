# dsh-context7

Context7 up-to-date library documentation for DSH.

给 DSH 接入 [Context7](https://context7.com) 的官方 Public API v2，让模型随时获取最新、版本精确的库文档与代码示例。纯 Host 插件，注册两个模型工具：

| 工具 | 用途 |
| --- | --- |
| `context7_search` | 按库名搜索（可带自然语言问题做 LLM 排序），返回匹配库及其 Context7 库 ID（如 `/vercel/next.js`） |
| `context7_get_docs` | 按库 ID（或裸库名，自动解析）＋自然语言问题，拉取 LLM 重排序的最新文档：代码示例、文档片段、库规则与源 URL；支持 `version` 固定版本（如 `v15.1.8`） |

无需 API key（Context7 允许无 key 低限额访问；需要更高限额可到 [context7.com/dashboard](https://context7.com/dashboard) 申请 `ctx7sk` 开头的 key）。

## 配置 API key（可选）

在 profile 的 `cordis.patch.yml`（如 `~/.dsh/profiles/web/cordis.patch.yml`）里给插件行填 `config.apiKey`：

```yaml
- id: dsh-context7
  config:
    apiKey: ctx7sk_你的key
```

保存后重启 DSH 生效。填了 key 后请求会带 `Authorization: Bearer` 头，获得更高限额。

## 一键安装

从 GitHub 安装（已验证）：

```bash
dsh plugin --profile web add github:Nrxous/dsh-context7
```

安装后重启 DSH 即生效；工具会在模型需要最新库文档时被自动调用，也可直接提问触发。

## 本地开发

纯 JS 插件（无构建步骤），`main: src/index.js`，运行时依赖 `schemastery`（宿主提供）。

```bash
# 热装配到 web profile（免重启）
dev_install_package <本目录>
# 或注入器环境内
dev_inject_plugin <本目录>
```

## 协议

Apache-2.0
