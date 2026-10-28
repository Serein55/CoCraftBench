# Mineflayer 接入指南

面向用 Mineflayer 自研 Agent 的开发者。本文说明如何把 CoCraftBench 的任务接到你的 bot 上，以及哪些行为会让回合被判无效。规范原文见 [Mineflayer接口规范.md](../benchmark-design/v0.3/Mineflayer接口规范.md)，动作契约见 [action-catalog.json](../benchmark-design/v0.3/action-catalog.json)。

## 1. 版本基线

本机源码核对版本的组合，评测时按此固定：

| 依赖 | 版本 |
|---|---|
| mineflayer | 4.33.0 |
| minecraft-data | 3.117.0 |
| prismarine-item | 1.18.0 |
| mineflayer-pathfinder | 2.4.5 |
| mineflayer-collectblock | 1.6.0 |
| mineflayer-pvp | 1.3.2 |
| 服务端 | Minecraft Java 1.21.6 原版（关闭实验性玩法与交易重平衡） |

`source-audit.json` 记录了这些文件的实际 SHA-256。换版本就等于换接口面，需要重新核对，不能沿用本文的结论。

## 2. 连接

评测端提供 host/port 与 bot 名称；正版验证模式下账号由评测端指定，离线模式用固定用户名。连接成功后先确认三件事再开始计时回合：

```js
bot.once('spawn', () => {
  // 版本、维度、游戏模式是否符合本题 fixture
  console.log(bot.version, bot.game.dimension, bot.game.gameMode);
});
```

单人存档经“对局域网开放”得到的端口与原版专用服务器行为不完全一致（例如部分事件与命令权限），正式评测以评测端封存的服务器为准；本地调试用哪种都行，但不要把本地现象写进结果报告。

## 3. 工具层结构

```
玩家中文指令
  → 规划器（目标、材料依赖、阶段、失败恢复）
  → 工具层（本仓库的 42 个动作，负责参数校验、租约、取消、结果 schema）
  → 本地控制器（挖掘/合成/战斗/开窗的状态机）
  → Mineflayer 与插件
  → 游戏服务器
```

工具层不是对 `bot.*` 的简单改名。它至少要做到：

- 每个动作声明自己的前置条件与后置条件，返回 `succeeded` 只代表**本动作**的局部后置条件成立。
- 统一旧接口的结果类型（boolean、字符串、void 混用会让规划器无法判断结果），补齐身份校验、取消与清理。
- 把参数和返回限制在 [请求 schema](../benchmark-design/v0.3/action-request.schema.json) / [结果 schema](../benchmark-design/v0.3/action-result.schema.json) 允许的范围内。

## 4. 观测：`observe.snapshot`

只返回公开感知半径内、**已加载**的数据，并标注观测刻与来源：

| 字段 | 来源 | 注意 |
|---|---|---|
| 方块 | `bot.blockAt`、`bot.findBlocks` | 未加载区块返回 unknown，不能当空气；不要扫隐藏区域 |
| 实体 | `bot.entities` | 不在缓存里不等于已死亡，只说明当前不可见 |
| 背包/装备 | `bot.inventory`、装备槽 | 槽位引用带 `inventory_revision` 与物品指纹 |
| 自身状态 | `bot.health`、`bot.food`、`bot.oxygenLevel`、`bot.experience` | 效果按 1.21.6 数据解码 |
| 窗口 | 当前打开的 window | 只公开当前合法窗口 |

物品组件用 prismarine-item 的运行时 `components`，但类型声明不完整，需要按目标版本解码 `charged_projectiles`、`bundle_contents`、`map_id`、`enchantments`、`damage`、`potion_contents` 等；未知组件返回 `unknown` 并保留诊断。**不允许修改本地 `components` 冒充游戏状态。**

## 5. 动作面

42 个动作按实现难度分 7 层，逐条对照见[动作映射表](action-map.md)：`native_wrapper` 11 个、`plugin_wrapper` 2 个、`controller_required` 14 个、`experimental_controller` 9 个，其余 8 个属于规划/表现/调度服务。

建议实现顺序（也是规范给出的顺序）：

1. 状态读取、身份与动作生命周期（`observe.snapshot`、`action.status`、`action.cancel`、`verify.local`）。
2. 采集、制作、熔炼、容器、蓝图（`gather.collect`、`block.break`、`block.place`、`craft.make`、`furnace.smelt`、`inventory.*`、`build.blueprint`）。
3. 交易、附魔、铁砧（`villager.trade`、`enchanting.enchant`、`anvil.process`）。
4. 弓弩盾与计时近战（`combat.shoot`、`combat.shield`、`combat.melee`）。
5. 特殊 GUI、收纳袋、1.21.6 载具（`workstation.process`、`inventory.bundle`、`vehicle.*`），没把握时返回 UNSUPPORTED 而不是假装支持。

## 6. 请求、结果与调度

- 每个请求带 episode/session/action 身份、`plan_revision`、`deadline_ms`（从接收起算的时长）和 `max_ticks`；墙钟与刻数先到者终止。
- 同一 `action_id` + 相同请求返回原执行记录，不重复执行；相同 ID 不同内容返回 `INVALID_ARGUMENT`。交易、消耗、射击、取输出都不可盲重放。
- `accepted` / `running` 是非终态。`failed` / `cancelled` / `indeterminate` 必须保留已经发生的副作用。
- 取消或超时：停止该动作自己的路径与采集/战斗流程、`bot.stopDigging()`、关闭它打开的窗口、注销监听器、释放租约，然后在 `cleanup` 里如实记录。不要调用笼统的 `clearControlStates` 抢走其他动作的控制权。
- 断线后未决动作标为 `indeterminate`，先对账再决定是否重试。

## 7. 引用与身份

- 实体：`entity_id` 只在当前连接短期有效，需同时携带 UUID、实体种类、session 和观测刻；陈旧引用先重新观察。
- 方块：带维度、格坐标、预期类型，交互前读回。
- 物品：对外槽位只指 bot 背包槽，带 `inventory_revision` 与物品指纹；打开 GUI 后内部另取 `window_lease_id`，并把背包槽换算到该窗口的 `inventoryStart` 偏移，不能沿用同一个数字。
- 名称统一用 `minecraft:` 命名空间，内部动态解析数值 ID，不跨版本硬编码。

## 8. 并发、计时与后台行为

- 每个 bot 同时只持有一个**写世界**动作租约：路径、挖掘、持续持用、窗口、载具输入共享同一个调度。只读观测可并行。
- `auto-eat`、`pvp`、`collectBlock` 这类后台行为必须纳入同一租约，否则回合不可复现。
- 蓄力、起盾、近战冷却、水桶落地由本地控制器跟 `physicsTick` 跑；LLM 只给目标和策略。
- `client_tick` 是本地物理刻，不是权威服务端刻；卡顿时墙钟与刻数会偏离，需要记录。

## 9. 证据边界

| 层 | 内容 | Agent 可读 |
|---|---|---|
| E0 | 自己的工具请求、时间、参数、返回 | 是 |
| E1 | 客户端快照、公开事件、控制器估计 | 是，估计值必须标注 |
| E2 | 服务端命中归因、掉落来源、隐藏 fixture、最终判分 | 否，仅 grader |

`verify.local` 返回 true 只代表局部检查通过；`event_count`、`crafted_output_at_least`、建筑匹配率、重生与来源链这些计分条件由独立 grader 在服务端验证，Agent 自报不算。

## 10. 安全与评测污染

这些是无效回合或直接失败的来源，工具层要硬性拦截：

- **作弊分支**：`breakBlockAt`、`goToPosition` 的 cheat 模式，`placeBlock` 的 `dontCheat: false` 默认值，`equip`/`placeBlock` 的 creative 注入路径。评测时必须强制关闭，服务器也不给管理员权限。
- **攻击玩家**：所有 `player` 实体默认禁攻（含真人及无法确认归属的 player）；自动反击、pvp 追击、范围攻击、弹射物射线同样适用。收到 `PLAYER_DAMAGE_RISK` 后停止该动作并重新选址，不能换武器绕过。
- **聊天泄露**：工具调用走内部结构化通道，聊天只经 `npc.say` 发自然语言。`bot.chat` 原始命令、`!attackPlayer`、工具 JSON、`/` 指令都禁止；过滤覆盖原始模型消息、执行回显、错误日志三个出口。
- **`attackEntity` 的结束条件**：目标从附近列表消失不能证明击杀，需要独立证据。

## 11. 接入检查清单

- [ ] 版本组合与 `source-audit.json` 一致，服务端为 1.21.6 原版。
- [ ] `observe.snapshot` 只返回已加载数据，并带观测刻与 unknown 原因。
- [ ] 42 个动作的名称、参数、返回符合 schema；未实现的动作返回明确错误码（`UNSUPPORTED` / `VERSION_MISMATCH`），不返回假成功。
- [ ] 写世界动作共用单一租约，取消路径有清理并在 `cleanup` 记录。
- [ ] 后台插件行为纳入租约；作弊分支已关闭。
- [ ] 玩家禁攻与聊天过滤有专项回归用例。
- [ ] 每题跑完能输出 E0/E1 记录，且不依赖 E2 数据。

## 12. 常见坑

- 弓满蓄力阈值（MC-61 暂定 20 刻）需要固定地图预验；弩要先 `load` 再验证带电状态，不能套用弓的释放流程。
- `activateBlock` / `activateEntity` 走主手，副手持盾需要单独处理 `activateItem(true)` 与起盾延迟。
- `bot.attack` 返回 void，不证明命中；攻击包数不是有效命中数。
- `moveVehicle` 只接收 `left` / `forward`，没有通用三维飞行接口；快乐恶魂驾驶仍属 experimental。
- 制图台放大与锁定要分两次取出；砂轮保留诅咒；锻造要保留工具有效组件。打开 GUI 不等于能完成操作。
- `bot.fish` 自带浮漂检测，但空水域、断线、超时、收杆后拾取仍需处理；考古不能用 `dig` 代替。
