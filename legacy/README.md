# legacy：Mindcraft 部署记录（已归档）

本目录是项目早期的本机 Mindcraft 部署材料，**不再作为主线**。当前基准面向 Mineflayer（4.33.0）自研 Agent，接入方式见[根目录 README](../README.md)与[接入指南](../docs/mineflayer-integration.md)。

| 文件 | 原用途 |
|---|---|
| `部署说明.md` | Mindcraft 本机部署步骤（Java 1.21.6 + 书生网关） |
| `部署验证.md` | 2026-10-27 的部署验证记录 |
| `configure-key.cmd` / `.ps1` | 把 API Key 写入 `mindcraft/keys.json` 的交互脚本 |
| `start-mindcraft.cmd` | 用 Node 22 运行时启动 Mindcraft |

使用前提与限制：

- 这些脚本假定仓库根目录存在 `mindcraft/`（上游 `mindcraft-bots/mindcraft` 的克隆）与 `runtime/node-v22.*-win-x64/`。两者都按 `.gitignore` 排除、不随本仓库分发，因此脚本只在本机原环境下可用；脚本内的相对路径已从 `%~dp0` 调整为 `%~dp0..`。
- `keys.json` 含明文 API Key，已由 `.gitignore` 排除。不要把该文件复制进仓库或提交。
- 归档材料中的验证结论只覆盖安装、进入世界、状态读取和一次中文回复；采集、合成、导航等任务成功率均未验证。
