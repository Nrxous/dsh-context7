# dsh-context7

Context7 up-to-date library documentation for DSH.

给 DSH 接入 [Context7](https://context7.com) 的官方 Public API v2，让模型随时获取最新、版本精确的库文档与代码示例。纯 Host 插件，注册两个模型工具：

| 工具 | 用途 |
| --- | --- |
| `context7_search` | 按库名搜索（可带自然语言问题做 LLM 排序），返回匹配库及其 Context7 库 ID（如 `/vercel/next.js`） |
| `context7_get_docs` | 按库 ID（或裸库名，自动解析）＋自然语言问题，拉取 LLM 重排序的最新文档：代码示例、文档片段、库规则与源 URL；支持 `version` 固定版本（如 `v15.1.8`） |

无需 API key（Context7 允许无 key 低限额访问；需要更高限额可到 [context7.com/dashboard](https://context7.com/dashboard) 申请 `ctx7sk` 开头的 key）。

## 一键安装

```bash
dsh plugin --profile web add dsh-context7
```

或从 GitHub 仓库安装：

```bash
dsh plugin --profile web add github:Nrxous/dsh-context7
```

安装后重启（或热装配）即可使用；工具会在模型需要最新库文档时被自动调用，也可直接提问触发。

## 本地开发

纯 JS 插件（无构建步骤），`main: src/index.js`，运行时依赖 `@deepseek-ai/dsh-tools`（宿主提供）。

```bash
# 热装配到 web profile（免重启）
dev_install_package <本目录>
# 或注入器环境内
dev_inject_plugin <本目录>
```

## 协议

Apache-2.0
