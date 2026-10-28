# MC-NPC-100：Mineflayer 接口规范 v0.3

本文只定义接口与评测映射，不接入或修改现有 Agent。原始50题与扩展100题均保留。目标 Java 1.21.6；核对日期2026-10-28。

## 1. 核对范围与结论

本地安装：mineflayer 4.33.0；minecraft-data 3.117.0；prismarine-item 1.18.0；mineflayer-pathfinder 2.4.5；mineflayer-collectblock 1.6.0；mineflayer-pvp 1.3.2。以安装目录的实际源码（包含本地补丁）为准，版本和文件SHA-256见[源码核对记录](source-audit.json)。调用面已查证；游戏行为、性能、控制成功率和整题可完成性均未实机验证。

| 层次 | 本文含义 | 不能据此认定 |
|---|---|---|
| native_wrapper | 对已查到的原生调用做规范化封装 | 封装已经写好或任务已通过 |
| plugin_wrapper | 已安装插件暴露相关接口 | 插件适配了所有1.21.6机制 |
| controller_required | 有基础调用，需局部状态机或闭环 | 单次调用能完成玩法 |
| experimental_controller | 特殊协议/GUI/物理尚有缺口 | 可直接列为“已支持” |
| planner_service / presentation_service / orchestrator_service | Agent计划、聊天和调度层 | Mineflayer原生提供长期规划 |

42个拟议操作以[action-catalog.json](action-catalog.json)为唯一命名与参数依据；它们都尚未实现。具体数量由[静态检查](validation.json)给出。禁止将拟议接口名称写成Mineflayer已有方法。

## 2. 分层与权限边界

玩家自然语言 → 规划器（目标、材料依赖、阶段、失败恢复）→ 本规范工具层 → 本地技能控制器 → Mineflayer/插件 → 游戏服务器。

独立grader读取服务器真实事件与世界状态。grader只向实验记录写结果，不能成为Agent的额外感官。世界初始化/重置、隐藏奖励设置、管理员指令属于评测设施，绝不放入Agent工具菜单。长程规划保存在Agent服务，不藏进一个“完成整题”工具。

比较规划器时固定同一版本的工具层与控制器，公布可调用操作、默认参数、各自的动作/重试预算；分别记录LLM调用、技能调用和底层交互数量。若改进控制器，另做“原规划器+新工具层”消融。否则无法判断收益来自规划还是接口能力增加。

### 现有Mindcraft技能如何对接

本地skills.js已有采集、制作、熔炼、放置、导航和交易等候选函数；逐项函数名、源码行号与适配缺口见[mindcraft-bridge-candidates.json](mindcraft-bridge-candidates.json)。这些仅为复用候选，不是已接入接口。新规范必须统一旧函数的boolean/字符串/void结果，补身份、取消与后置条件核验。

特别需要排除评测污染：breakBlockAt/placeBlock/goToPosition含cheat模式分支，equip/placeBlock还有creative物品注入路径；placeBlock的dontCheat默认false。未来评测适配必须强制关闭这些路径，服务器不给Agent管理员权限，并记录实际资源来源。attackEntity以目标不再出现在附近列表结束循环；离开视野不能证明击杀，需改为独立证据核验。这些是本次只读源码发现，尚未修复现有代码。

## 3. 请求、返回与身份

使用[action-request.schema.json](action-request.schema.json)及[action-result.schema.json](action-result.schema.json)，均为JSON Schema draft-07。可复制的请求与结果见[请求示例](request-examples.json)、[工具缺口示例](result-example.json)。这些是拟议格式，不是现有Mindcraft指令语法。

- 请求包含episode/session/action/plan身份、plan_revision、deadline_ms（从接收起的时长上限）、max_ticks、name及arguments。tick预算和wall预算先到者终止；不是Unix截止时间。
- entity_id只在当前连接短期有效；同时带UUID、实体种类、session和观测刻。重连必须重新解析；UUID缺失或陈旧先重新观察，不能猜最近实体。
- 方块引用带维度、格坐标和预期类型；交互前读回。物品/实体名称使用minecraft命名空间，内部动态解析数值ID，不跨版本硬编码ID。
- 对外slotRef只指bot自己的背包槽，带inventory_revision和物品指纹，由snapshot返回；库存变化即递增revision。指纹包含物品名、数量、组件及耐久摘要；不是天然稳定的“工具UUID”。控制器打开GUI后内部获取独占window_lease_id，并把源背包槽转换到该窗口的inventoryStart偏移，不能沿用同一个数字槽位。槽位移动即重新解析。
- accepted/running是非终态；succeeded仅说明该操作的局部后置条件成立，绝不是整题通过。failed/cancelled/indeterminate须保留已发生的副作用。取消也可能已消耗一箭或放下一块材料。
- schema校验仅约束结构；目标存在、维度一致、目标类别、合法operation组合、余额和保护规则必须再做语义校验。condition.expected和物品组件是扩展数据，不能只凭JSON通过就当语义正确。

同一action_id+同一请求返回原执行记录，不重复执行；相同ID不同内容返回INVALID_ARGUMENT。交易、消耗、射击和取输出均不可盲重放。连接中断后未决动作标为indeterminate，先对账再决定是否重试。action.status/action.cancel使用自己的新action_id，arguments.action_id指向待查询/取消动作。

## 4. 并发、计时与取消

每个bot一次仅持有一个写世界动作租约；路径、挖掘、持续持用、窗口与载具输入都纳入同一调度。可并行只读观测。防御/救援是同一控制器内的优先状态切换，不能与另一个控制器争抢手部或路径。auto-eat、pvp、collectBlock等后台行为必须纳入相同租约，否则基准不可复现。

一旦取消/超时/断线/目标revision改变：停止所属路径与采集/战斗流程，stopDigging，释放该动作持有的控制与物品使用，关闭其窗口，注销监听器，保存已发生效果并释放租约。不可调用笼统clearControlStates破坏其他动作控制权。finally也必须运行。清理状态在返回cleanup中如实记录；运行中可能尚未释放。

蓄力、起盾、近战间隔和水桶落地由本地控制器随physicsTick运行，LLM只给目标/策略。client_tick只是本地物理刻；不能假装是权威server_tick。卡顿导致墙钟和刻数偏离时必须记录。窗口采用事件等待+超时，不用固定睡眠猜测输出已到。

## 5. 观测和现代组件

snapshot仅返回公布感知范围内的已加载方块、实体、自己的背包/装备/血量/饥饿/氧气/经验/效果，以及当前合法打开的窗口。未知区块不能当空气，实体不在缓存不能当已死亡。建议输出按信息项带observed_at_tick、来源及unknown原因；完整世界快照仅grader拥有。

prismarine-item运行时有components/componentMap，类型声明并不完整。须为charged_projectiles、bundle_contents、map_id/map_post_processing、enchantments/stored_enchantments、damage、potion_contents等做目标版本解码并保留原始摘要。组件名和结构以1.21.6实际数据为准；未知组件返回unknown并保留诊断，不退回“全是NBT”的假设。只允许读取，禁止通过改本地components冒充游戏成功。Item.enchants、durabilityUsed、customName等访问器也要与实际组件对照。

原生entityCriticalEffect、entityHurt、playerCollect、entityUpdate、blockUpdate和window事件可用于局部证据；它们不能单独证明精确攻击强度、有效格挡、某次暴击归因或全链资源来源。

## 6. 高风险接口逐项规范

### 制箭台、村民与特殊工作站

MC-51用craft.make在工作台合成箭；制箭台用作MC-52/53职业绑定。交易动态读取trades，先匹配输入/输出及第二输入，再解析索引。固定贸易是评测fixture，不能外推普通世界。

砂轮、制图台、石切机、锻造台、合成器分别建立版本化“窗口类型—输入槽—输出槽—按钮/配方选择—结果组件”表。打开GUI不代表能完成操作。禁用合成器槽位可能需要尚未核实的专用交互；没有稳定实现则UNSUPPORTED。参数先验证工作站与operation匹配，再写槽；意外窗口立即WINDOW_MISMATCH，不能继续盲点。制图台放大与锁定分两次取出；砂轮保留诅咒；锻造保留工具有效组件。

### 弓、弩、盾与近战

原生activateItem/deactivateItem是持用与释放。弓的满蓄力阈值以固定地图预验，MC-61暂定20刻；远近弹道、目标移动预测、障碍和射线安全由控制器处理。弩先load再切槽验证带电状态，再fire；不把弓的释放流程直接套到弩。

盾牌equip到off-hand后activateItem(true)持续持用，再朝向威胁；需处理起盾延迟、禁用和转向。activateBlock/activateEntity源码走主手，不能认为其副手参数已存在。

bot.attack返回void，不会自动证明打中或等满冷却。pvp插件有攻击计时器，但尚未验证这些题目；精确冷却、暴击条件和重锤下落伤害需要独立预验/服务器证据。不能把attack包数算成有效命中数。恶魂火球反击另有白名单和来源链，不开放任意实体攻击。

### 载具与1.21.6玩法

mount/moveVehicle/dismount确实存在。moveVehicle仅接收left/forward；newPlayerInputPacket分支发送水平输入，未暴露通用三维飞行接口。dismount同分支发送jump:true，源码线索不能代替下乘实测。快乐恶魂驾驶位、上下/制动、输入合并、被动乘客、货物吊运与安全下乘均列为experimental。缺控制器返回UNSUPPORTED，MC-88/91/100仍留在基准分母，不能假装全部已支持。

幼年快乐恶魂仍是happy_ghast年龄状态；没有ghastling独立实体ID。雪球喂食走实体交互，发射雪球不能替代。含水风干恶魂到幼体、成长到成年由真实世界时间推进，world.wait_until只监测，不快进。拴绳图、剪绳/剪装备、马匹与船控制分别预验。

### 钓鱼、考古、营火和试炼

bot.fish已含浮漂/粒子咬钩检测和收竿，不必从头伪造检测API；仍需处理空水域、断线、超时、收杆及渔获拾取。考古持续刷扫序列需实测，绝不可改用dig。营火是方块交互+真实加工+拾取，无openFurnace等效GUI。试炼工具仅激活/观察，不包办整题；宝库资格、奖励归属和灾厄转换由grader核实。

## 7. 禁止攻击玩家与隐藏命令

这是拟议规范，未改当前Agent设置或源码。未来实现应在工具入口与每次实际伤害执行前检查：所有玩家实体默认禁止，包含真人和无法确认归属的player实体；显式目标、自动反击、pvp追击、范围攻击与弹射物射线都适用。允许按任务攻击怪物、合法动物目标和可反射火球，但必须检查旁观玩家与保护动物风险；无法安全控制爆炸/重锤范围时拒绝该动作。收到PLAYER_DAMAGE_RISK后停止该次动作，重新选择安全位置，不把拒绝绕过为另一种武器。

工具调用走内部结构化通道，聊天仅经npc.say发自然语言进度/问题/完成或失败说明；不能bot.chat原始命令、!attackPlayer、工具JSON、/指令。过滤至少涵盖原始模型消息、执行回显和错误日志三个出口。内部审计保留真实工具调用，但玩家聊天不显示。发布前增加“玩家禁止受伤”“聊天无原始命令”专项回归；安全违规与聊天泄漏指标分开，不能仅靠藏命令解决攻击行为。

## 8. 长程规划接口

用plan.checkpoint保存目标revision、当前阶段、完成条件、材料账本、公开地标、未决动作；每次实际后置条件成立才推进。规划器负责依赖分解，如原木→木板/工作台/工具→石器/熔炉→资源补齐→房屋地基/墙/屋顶→门窗→核验，工具层不暗中替规划器补全整题。

MC-48重启后plan.resume必须将账本与世界/背包对账，修正已完成但未写入的动作；不依赖RAM或聊天全文。MC-49取消旧revision、核验在途副作用、只改屋顶的新蓝图再继续。MC-50先获取真实精准采集工具，再采草方块并验证拾取来源，不靠自然采集误判。

## 9. 证据分层与100题绑定

| 层 | 内容 | Agent可读取 |
|---|---|---|
| E0 | 工具请求、时间、参数与返回 | 自己的调用记录 |
| E1 | 客户端快照、公开事件、控制器估计 | 可以，但估计必须标注 |
| E2 | 服务器动作/命中归因、掉落与资源来源、隐藏fixture、任务最终判分 | 不可以，仅实验grader |

每题的每个success_all条件在[task-interface-map.json](task-interface-map.json)绑定原始JSON Pointer与条件哈希；没有把中文mechanic_check偷偷变成已实现判定器。客户端拿到true只表示局部检查，所有计分条件仍由独立grader权威验证。精确战斗、未交易职业锁定、宝库每人使用、重生锚绑定、Tears来源和全链自然采集必须明确设计E2采集；目前grader尚未实现。

映射保留140种原能力名并全部绑定操作。action_ids是相关操作集合，包含不同可行路径，不是每次都必须调用的最小动作序列；规划器仍根据当前状态选择。common_actions是统一观察/导航/装备/调度设施；supplementary_actions补上原标签未完整表达的交互，不改原任务正文。逐题人读表见[100题接口映射](100题接口映射.md)。

## 10. 预验与发布门槛

本次只做静态核对：100题和原条件哈希完整、能力名全覆盖、动作引用存在、请求/结果schema可编译、示例可验证、旧文件与Agent未改。所有物理、协议、GUI、世界fixture和grader检查均not_run。

后续实现顺序：先统一读状态/身份/动作生命周期；再采集/制作/熔炼/容器与蓝图；随后交易/附魔/铁砧；再弓弩盾/计时近战；最后特殊GUI、考古、收纳袋及1.21.6载具。逐操作跑固定fixture，明确输入、结果和失败清理，再组合任务。仅接口预验失败不应误归为模型规划失败，但tool_gap仍按原协议留在任务成功率分母，并单列原因。

错误码定义见[动作目录](action-catalog.json)对应契约与result schema枚举。可重试仅限已知无副作用的短暂状态；UNSUPPORTED、VERSION_MISMATCH、PLAYER_DAMAGE_RISK不能盲目循环重试。INDETERMINATE先对账，TIMEOUT必须输出部分效果与清理状态。
