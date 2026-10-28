# 动作映射表

本文件由 `node tools/gen-action-map.mjs` 从 [action-catalog.json](../benchmark-design/v0.3/action-catalog.json) 生成，请勿手改。

共 42 个动作（native_wrapper 11 个、plugin_wrapper 2 个、controller_required 14 个、experimental_controller 9 个、planner_service 3 个、presentation_service 1 个、orchestrator_service 2 个），实现状态均为 `spec_only`：契约已定义，代码尚未实现，也没有游戏内验证。

层次含义：

| 层次 | 含义 |
|---|---|
| `native_wrapper` | 对已核对的 Mineflayer 原生调用做规范化封装 |
| `plugin_wrapper` | 由已安装插件暴露的接口 |
| `controller_required` | 有基础调用，需要局部状态机或闭环控制 |
| `experimental_controller` | 特殊协议、GUI 或物理仍有缺口，未验证 |
| `planner_service` | 规划器侧的持久化与阶段推进 |
| `presentation_service` | 聊天表现层 |
| `orchestrator_service` | 动作调度、查询与取消 |

“依赖调用”只表示该动作可以落到的 Mineflayer/插件接口面，不代表单次调用就能完成任务。

## native_wrapper（11）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `observe.snapshot` | 读取可见状态 | spec_only | not_run | `bot.blockAt`<br>`bot.findBlocks`<br>`bot.entities`<br>`bot.inventory`<br>`bot.health`<br>`bot.food`<br>`bot.oxygenLevel`<br>`bot.experience`<br>`bot.game`<br>`Item.enchants`<br>`Item.components` |
| `block.break` | 破坏单个方块 | spec_only | not_run | `bot.dig`<br>`bot.stopDigging`<br>`bot.digTime`<br>`bot.equip` |
| `inventory.equip` | 装备物品 | spec_only | not_run | `bot.equip`<br>`bot.unequip`<br>`bot.setQuickBarSlot` |
| `inventory.transfer` | 背包与容器转移 | spec_only | not_run | `bot.openContainer`<br>`bot.transfer`<br>`bot.clickWindow`<br>`bot.putAway`<br>`Chest.deposit`<br>`Chest.withdraw`<br>`bot.toss` |
| `craft.make` | 按版本配方制作 | spec_only | not_run | `bot.recipesFor`<br>`bot.craft` |
| `furnace.smelt` | 熔炉处理 | spec_only | not_run | `bot.openFurnace`<br>`Furnace.putInput`<br>`Furnace.putFuel`<br>`Furnace.takeOutput` |
| `villager.trade` | 检查并执行交易 | spec_only | not_run | `bot.openVillager`<br>`Villager.trades`<br>`bot.trade` |
| `enchanting.enchant` | 附魔台操作 | spec_only | not_run | `bot.openEnchantmentTable`<br>`EnchantmentTable.putTargetItem`<br>`EnchantmentTable.putLapis`<br>`EnchantmentTable.enchant`<br>`EnchantmentTable.takeTargetItem` |
| `anvil.process` | 铁砧修理附魔重命名 | spec_only | not_run | `bot.openAnvil`<br>`Anvil.combine`<br>`Anvil.rename`<br>`Item.anvil` |
| `world.fish` | 抛竿与收竿 | spec_only | not_run | `bot.fish`<br>`bot.activateItem`<br>`bot.entities` |
| `verify.local` | 检查局部后置条件 | spec_only | not_run | `bot.blockAt`<br>`bot.inventory`<br>`bot.entities`<br>`bot.game` |

契约要点：

- **`observe.snapshot`**：只返回公开给Agent的感知半径内、已加载数据。未加载和未解码字段返回unknown；禁止查询评测隐藏区域、全世界容器和服务器完整状态。
- **`block.break`**：重新读取方块和工具；保护检查后挖掘，完成后验证方块变化；dig完成不等于产物已拾取。
- **`inventory.equip`**：读取实际槽位物品组件与耐久；卸装作为单独操作策略，不以装备成功代替盾牌举起。
- **`inventory.transfer`**：容器操作须有新鲜目标和独占窗口租约；rearrange需目标槽，drop需许可丢弃区域。逐次校验cursor与前后数量，不将移入箱子的物品再算最终背包持有。
- **`craft.make`**：output_count是目标产物数；bot.craft的count是配方执行次数，须按每次产量换算并记录实际消耗/产出。区分2x2和工作台3x3，不对制箭台调用造箭GUI。材料不足交回规划器补齐。
- **`furnace.smelt`**：确认容器类型、燃料与配方；耗时期间监测燃料/输出/背包，取出后验数量，支持可恢复进度。
- **`villager.trade`**：从最新trades按物品组件/价格匹配动态tradeIndex，检验第二输入、库存、折扣和输出；不固定交易索引，不假定所有村民有评测地图指定交易。
- **`enchanting.enchant`**：等候选就绪后校验offer、青金石和等级；槽位索引与显示等级不同。30级选项不等于消耗30级，也不保证精准采集。取出工具检查实际附魔。
- **`anvil.process`**：有second调用combine，否则rename必填并调用rename；预算以工具先前惩罚、有效附魔兼容与实际XP为准。结果核对耐久、附魔、自定义名称。
- **`world.fish`**：原生fish已含浮漂/粒子咬钩检测与收竿逻辑；仍需水域、鱼竿、超时清理、渔获拾取与数量验证，不把promise完成当捕到鱼。
- **`verify.local`**：输出true/false/unknown及证据索引；只能判断Agent可观测条件，禁止给出隐藏grader判分或自行宣布整题通过。

## plugin_wrapper（2）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `navigation.goto` | 到达位置 | spec_only | not_run | `bot.pathfinder.goto`<br>`bot.pathfinder.setMovements`<br>`bot.pathfinder.stop` |
| `gather.collect` | 采集指定资源 | spec_only | not_run | `bot.collectBlock.collect`<br>`bot.collectBlock.cancelTask`<br>`bot.dig`<br>`bot.pathfinder.goto` |

契约要点：

- **`navigation.goto`**：Movements必须套用保护区域、禁止破坏物、掉落风险和材料限制；默认不得私自挖穿建筑。到达容差后核验，pathfinder无路线返回NO_PATH。
- **`gather.collect`**：区分挖掘数与实际拾取数，region必须是公开许可区域。背包满不得任意扔工具或存进未授权箱子。草方块须先查有效精准采集工具；原木累计采集来源由grader核实。

## controller_required（14）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `navigation.control` | 短时移动与朝向 | spec_only | not_run | `bot.setControlState`<br>`bot.clearControlStates`<br>`bot.lookAt`<br>`bot.waitForTicks` |
| `block.place` | 按朝向放置方块 | spec_only | not_run | `bot.placeBlock`<br>`bot.placeEntity`<br>`bot.lookAt`<br>`bot.setControlState` |
| `item.use` | 使用手中物品 | spec_only | not_run | `bot.activateItem`<br>`bot.deactivateItem`<br>`bot.activateBlock`<br>`bot.activateEntity`<br>`bot.activateEntityAt`<br>`bot.consume` |
| `brewing.brew` | 酿造流程 | spec_only | not_run | `bot.openBlock`<br>`bot.transfer`<br>`bot.clickWindow` |
| `villager.manage_job` | 村民职业与工作站 | spec_only | not_run | `bot.placeBlock`<br>`bot.dig`<br>`bot.entities`<br>`bot.openVillager` |
| `combat.melee` | 计时近战 | spec_only | not_run | `bot.attack`<br>`bot.lookAt`<br>`bot.setControlState`<br>`bot.entity.attributes`<br>`bot.pvp.attack`<br>`bot.pvp.stop` |
| `combat.shoot` | 弓弩射击 | spec_only | not_run | `bot.lookAt`<br>`bot.activateItem`<br>`bot.deactivateItem`<br>`bot.setQuickBarSlot`<br>`bot.entities` |
| `combat.shield` | 定向举盾 | spec_only | not_run | `bot.equip`<br>`bot.activateItem(true)`<br>`bot.deactivateItem`<br>`bot.lookAt` |
| `animal.interact` | 动物喂食装备与刷取 | spec_only | not_run | `bot.activateEntity`<br>`bot.activateEntityAt`<br>`bot.equip`<br>`bot.setControlState`<br>`bot.entities` |
| `world.portal` | 点燃与穿越传送门 | spec_only | not_run | `bot.activateBlock`<br>`bot.pathfinder.goto`<br>`bot.game`<br>`bot.waitForTicks` |
| `world.redstone` | 红石输入与状态反馈 | spec_only | not_run | `bot.activateBlock`<br>`bot.blockAt`<br>`bot.placeBlock` |
| `world.archaeology` | 持续刷扫可疑方块 | spec_only | not_run | `bot.activateBlock`<br>`bot.activateItem`<br>`bot.deactivateItem`<br>`bot.lookAt` |
| `world.wait_until` | 有限等待与状态监测 | spec_only | not_run | `bot.waitForTicks`<br>`bot.blockAt`<br>`bot.entities` |
| `build.blueprint` | 按蓝图建造与核验 | spec_only | not_run | `bot.placeBlock`<br>`bot.dig`<br>`bot.blockAt`<br>`bot.pathfinder.goto` |

契约要点：

- **`navigation.control`**：限时控制；按物理刻运行，自动释放。水下、粉雪、潜行、坠落控制分别预验。LLM不逐刻调用。
- **`block.place`**：destination为整数格坐标；必须从相邻support+face解析，禁止把绝对目标坐标直接当placeBlock参数。原生placeBlock不保证朝向/含水/床双格等状态；放置后读回properties。
- **`item.use`**：block/entity模式强制对应target。activateItem(true)可用副手，但activateBlock/activateEntity内部交互主手，副手定点交互未验证时返回UNSUPPORTED；禁止静默换手。雪球喂食须对实体交互，不能向幼体发射。
- **`brewing.brew`**：没有专用openBrewingStand接口的核实证据；须版本化GUI槽位与酿造状态适配。区分药水类型、延长时长和实际瓶数，失败不得虚报完成。
- **`villager.manage_job`**：摆放工作站不是职业成功证明；确认村民身份、工作时段和目标变化，已交易村民不可作为随意洗职业对象。未知职业元数据保留unknown。
- **`combat.melee`**：所有打击执行前重新排除玩家和禁止目标。pvp插件仅是候选普通近战实现，不证明1.21.6暴击/重锤正确。冷却强度估计、下落状态和攻击距离需控制器；精确判分需服务器证据。
- **`combat.shoot`**：本地按物理刻完成蓄力、释放、提前量和弹道；弩load必须保留装填状态供切槽验证。检查charged_projectiles等组件可读性；发送use_item不是射击命中证明。
- **`combat.shield`**：副手装备后持用并面向威胁，考虑起盾延迟和禁用；健康未减不能独自证明格挡，服务器记录正面弹射物格挡次数。退出释放持用状态。
- **`animal.interact`**：身份、年龄、主人和装备状态要读回，不能以实体ID永久记忆。喂食/装备交互不是攻击；1.21.6剪装备、刷犰狳需独立预验。
- **`world.portal`**：只能正常生存交互；记录双向地标，等待实际dimension变化、chunk和实体就绪，清除旧路径/旧entity_id/窗口租约。禁止tp。
- **`world.redstone`**：由真实红石网络响应；不是模拟器替世界改状态。读取powered/朝向/方块移动和容器流转；合成器脉冲需已完成GUI配置。
- **`world.archaeology`**：锁定具体可疑方块，验证持续使用与dusted等状态推进，不调用dig代替刷扫；持续包序列必须1.21.6预验，底层组合不能先宣称成功。
- **`world.wait_until`**：用于生长、孵化、红石自然变化等，只等待不快进世界；记录主动/被动等待，必须受剩余wall预算约束，超时checkpoint并交回规划。
- **`build.blueprint`**：从发布给Agent的蓝图解析方块清单、放置序与差异；只做允许的局部修复，不偷偷生成材料。restart从世界重建完成状态；改屋顶后不得继续旧revision放置。

## experimental_controller（9）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `inventory.bundle` | 收纳袋操作 | spec_only | not_run | `bot.clickWindow`<br>`Item.components`<br>`Item.componentMap` |
| `workstation.process` | 特殊工作站操作 | spec_only | not_run | `bot.openBlock`<br>`bot.clickWindow`<br>`bot.transfer`<br>`bot.activateBlock` |
| `combat.parry` | 弹射物反击 | spec_only | not_run | `bot.attack`<br>`bot.entities`<br>`bot.lookAt` |
| `movement.clutch` | 坠落与风弹控制 | spec_only | not_run | `bot.entity`<br>`bot.activateBlock`<br>`bot.activateItem`<br>`bot.setControlState`<br>`bot.lookAt` |
| `vehicle.mount` | 选择并乘坐载具 | spec_only | not_run | `bot.mount`<br>`bot.activateEntity`<br>`bot.activateEntityAt`<br>`bot.vehicle` |
| `vehicle.drive` | 驾驶路径 | spec_only | not_run | `bot.moveVehicle`<br>`bot.lookAt`<br>`bot.setControlState` |
| `vehicle.dismount` | 安全下乘 | spec_only | not_run | `bot.dismount`<br>`bot.vehicle`<br>`bot.setControlState` |
| `animal.leash` | 拴绳关系操作 | spec_only | not_run | `bot.activateEntity`<br>`bot.activateEntityAt`<br>`bot.equip`<br>`bot.setControlState`<br>`bot.entities` |
| `trial.interact` | 试炼与宝库交互 | spec_only | not_run | `bot.activateBlock`<br>`bot.consume`<br>`bot.blockAt`<br>`bot.entities` |

契约要点：

- **`inventory.bundle`**：需1.21.6收纳袋窗口动作预验及bundle_contents解码；按堆叠权重计算容量。不能把bundle当普通箱子或仅修改本地组件。
- **`workstation.process`**：逐种工作站定义合法operation、窗口类型、状态ID与槽位表；GUI识别失败立即停止。石切机选择配方、合成器禁用槽位不能假设clickWindow足够；缺少已验证公共API时报告UNSUPPORTED，不向LLM开放原始包。
- **`combat.parry`**：仅对白名单可反击弹射物进行定时攻击；检查射线前方无玩家，拒绝泛化为攻击任意实体。恶魂死亡和Tears唱片必须另查反射来源链。
- **`movement.clutch`**：高频预测落点、在合法交互范围使用；不得依赖LLM网络往返逐刻救援。风弹起跳和重锤落击是不同操作，成功各自观察验证。
- **`vehicle.mount`**：确认目标、许可、乘客与座位；不能从发出mount就认定取得驾驶位。多座位快乐恶魂须预验。
- **`vehicle.drive`**：按载具分别实现；moveVehicle只提供left/forward。轨道运输也不等于自由驾驶。快乐恶魂上下/制动/座位与同步输入无已验证实现，预验前必须UNSUPPORTED，不伪造flyHappyGhast原生API。
- **`vehicle.dismount`**：核验落脚点和高度，再退出并等实际乘客关系解除。当前newPlayerInputPacket分支dismount发送jump:true，必须专门核验1.21.6语义，不能推定已可用。
- **`animal.leash`**：chain须holder；记录身份关系图与距离，不把跟随误判为拴绳。动物互拴、船载货物、快乐恶魂吊运需要1.21.6控制与可观察关系验证；无法观察则unknown。
- **`trial.interact`**：仅负责原子观察/交互，不包办整场战斗。完成试炼与奖励来源由grader判断；normal/ominous宝库、钥匙类型和玩家使用资格须分开。

## planner_service（3）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `plan.checkpoint` | 持久保存计划进度 | spec_only | not_run | — |
| `plan.resume` | 重启后恢复计划 | spec_only | not_run | — |
| `plan.revise` | 目标变更与重规划 | spec_only | not_run | — |

契约要点：

- **`plan.checkpoint`**：原子落盘保存结构化阶段与行动账本，不保存思维链或密钥。按动作后置条件推进，不以发出命令或聊天承诺当作完成。
- **`plan.resume`**：读持久状态并与当前世界、背包核对；未决action状态不明时先对账，禁止盲目重放交易/消耗类动作。
- **`plan.revise`**：先停止旧revision写动作并核对最终状态，再发布新revision。MC-49只变更屋顶材料，旧基座/门窗依照原蓝图约束。

## presentation_service（1）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `npc.say` | 向玩家自然语言反馈 | spec_only | not_run | `bot.chat` |

契约要点：

- **`npc.say`**：只发送自然语言；原始工具名/参数/!命令/函数调用仅写内部日志。此接口不得充当游戏命令执行通道。

## orchestrator_service（2）

| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |
|---|---|---|---|---|
| `action.status` | 查询动作 | spec_only | not_run | — |
| `action.cancel` | 取消动作 | spec_only | not_run | — |

契约要点：

- **`action.status`**：查询已有动作状态，不重新执行；暴露progress、可恢复阶段和剩余预算。
- **`action.cancel`**：幂等取消并等待控制权/窗口释放；返回partial_effects，不能假定已经发送的使用/攻击包被撤销。

## 延伸阅读

- 参数契约：[action-catalog.json](../benchmark-design/v0.3/action-catalog.json) 的 `arguments_schema`。
- 请求/返回外壳：[action-request.schema.json](../benchmark-design/v0.3/action-request.schema.json)、[action-result.schema.json](../benchmark-design/v0.3/action-result.schema.json)。
- 每题用到哪些动作：[task-interface-map.json](../benchmark-design/v0.3/task-interface-map.json) 与 [100题接口映射.md](../benchmark-design/v0.3/100题接口映射.md)。
- 能力到动作的对应：[capability-interface-map.json](../benchmark-design/v0.3/capability-interface-map.json)。
