# CoCraftBench

面向 Minecraft Java 版 1.21.6 的 NPC Agent 基准：**100 条中文任务 + Mineflayer 工具接口规范**。

当前状态：**设计与规范阶段**。任务、判据、接口契约和静态校验已完成；没有世界包、判分器、运行器，也没有实机成功率数据。正文里的动作全部是 `spec_only`，不能当作已实现接口。

## 面向 Mineflayer 开发者

你的 Agent 直接跑在 Mineflayer 上时，本仓库提供三样东西：**任务与判据**、**要暴露给规划器的 42 个动作契约**、**观测与证据边界**。

1. 先读[接入指南](docs/mineflayer-integration.md)：环境版本、连接方式、工具层结构、租约与取消、安全约束。
2. 查[动作映射表](docs/action-map.md)：42 个动作分别落在哪一层、依赖哪些 `bot.*`/插件调用。
3. 对照 [action-catalog.json](benchmark-design/v0.3/action-catalog.json) 的 `arguments_schema` 与 `contract_zh` 实现：参数和返回必须符合 [请求 schema](benchmark-design/v0.3/action-request.schema.json) / [结果 schema](benchmark-design/v0.3/action-result.schema.json)。
4. 用 [tasks-100.json](benchmark-design/v0.2/tasks-100.json) 的 `success_all` 和 [task-interface-map.json](benchmark-design/v0.3/task-interface-map.json) 确认每题要满足什么，记住**客户端自检不等于判分**。

环境基线（本机核对版本）：`mineflayer 4.33.0`、`minecraft-data 3.117.0`、`prismarine-item 1.18.0`、`mineflayer-pathfinder 2.4.5`、`mineflayer-collectblock 1.6.0`、`mineflayer-pvp 1.3.2`；目标服务端为原版 1.21.6、生存、普通难度。

## 仓库结构

```
README.md                      本文件
docs/
  mineflayer-integration.md    Mineflayer 接入指南
  action-map.md                42 个动作的分层与原生调用映射（由 tools 生成）
tools/
  gen-action-map.mjs           从 action-catalog.json 重新生成 action-map.md
benchmark-design/
  评测协议.md                  50 题协议：环境、预算、评分、失败分类
  任务清单.md                  50 题正文与判据
  tasks-50.json                50 题机器可读版本
  blueprints.json              建筑相对坐标蓝图
  validation.json              v0.1 静态检查结果
  v0.2/                        100 题扩展版
    tasks-100.json             100 题机器可读版本（含 success_all）
    100题总览.md / 玩法评测与技能覆盖.md / 新增50项游玩专项.md
    capability-coverage.json   140 种原能力覆盖
  v0.3/                        Mineflayer 4.33.0 接口规范版
    Mineflayer接口规范.md      分层、生命周期、并发、观测、证据
    100题接口映射.md           逐题操作与工具缺口
    action-catalog.json        42 个动作及输入契约
    capability-interface-map.json
    task-interface-map.json    100 题 × 每个 success_all 谓词绑定
    action-request.schema.json / action-result.schema.json
    source-audit.json          源码核对记录（文件 SHA-256）
    validation.json            静态检查结果
legacy/                       早期 Mindcraft 部署材料（已归档，非主线）
```

## 版本关系

| 版本 | 内容 | 入口 |
|---|---|---|
| v0.1 | 50 题协议、任务、蓝图 | [评测协议.md](benchmark-design/评测协议.md) |
| v0.2 | 扩展到 100 题，补齐能力覆盖 | [v0.2/100题总览.md](benchmark-design/v0.2/100题总览.md) |
| v0.3 | Mineflayer 接口规范与逐题映射，仍为 spec_only | [v0.3/README.md](benchmark-design/v0.3/README.md) |

## 已完成 / 未完成

已完成（静态检查，见 [v0.3/validation.json](benchmark-design/v0.3/validation.json)）：

- 100 题原对象与 success 谓词全部保留并绑定，共 230 条谓词。
- 140 种能力全部映射，动作引用均可解析，42 个动作契约齐全。
- 请求/结果 schema 可编译，示例通过校验，反向用例（非法武器、杜撰接口）被拒绝。

未完成：

- 世界快照、服务器端判分器、episode 运行器；v0.1 协议按 50 题 × A/B/C 需要 150 份实例，100 题版需要 300 份。
- 任何实机行为验证：导航、采集、合成、战斗、GUI、载具均 `not_run`。
- 时间与模型调用预算的校准。

## 评测约束摘要

以下约束对 Agent 端是硬性要求，细节见[接口规范](benchmark-design/v0.3/Mineflayer接口规范.md)：

- 只允许读取公开感知范围内的状态；隐藏 fixture、服务器完整世界和最终判分属于 grader，Agent 不可读。
- 禁用 Mineflayer 的作弊分支（`breakBlockAt`/`goToPosition` 的 cheat 模式、`placeBlock` 默认 `dontCheat: false`、creative 物品注入），服务器也不给管理员权限。
- 不攻击玩家（含无法确认归属的 `player` 实体），不使用 `bot.chat` 直接发送命令或工具 JSON。
- 一次只持有一个写世界动作租约；`auto-eat`、`pvp`、`collectBlock` 等后台行为同样纳入调度。
- 工具缺失按 `tool_gap` 计入任务成功率分母，不能从分母中删除。

## 本地校验

```bash
node tools/gen-action-map.mjs        # 重新生成 docs/action-map.md
node benchmark-design/v0.3/build-interfaces.mjs  # 重新生成 v0.3 文档与数据集
```

两个脚本只读写本地文件，不连接游戏、不调用模型。
