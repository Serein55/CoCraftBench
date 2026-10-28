import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

// Document generator only: no game connection, Agent import, or network requests.
const here = new URL('./', import.meta.url);
const root = new URL('../../', here);
const read = path => readFileSync(new URL(path, root), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const original = read('benchmark-design/v0.2/tasks-100.json');
const bench = JSON.parse(original);
const frozenPaths = ['mindcraft/settings.js', 'mindcraft/andy.json', 'mindcraft/src/models/prompter.js', 'mindcraft/src/agent/library/skills.js', 'mindcraft/package.json'];
for (const dir of ['benchmark-design/', 'benchmark-design/v0.2/']) {
  for (const name of readdirSync(new URL(dir, root))) {
    if (/\.(json|md|mjs)$/.test(name)) frozenPaths.push(dir + name);
  }
}
const frozen = Object.fromEntries(frozenPaths.map(p => [p, hash(read(p))]));
const json = (name, value) => writeFileSync(new URL(name, here), JSON.stringify(value, null, 2) + '\n');
const md = (name, value) => writeFileSync(new URL(name, here), value.trim() + '\n');
mkdirSync(here, { recursive: true });

const packageNames = ['mineflayer', 'minecraft-data', 'prismarine-item', 'mineflayer-pathfinder', 'mineflayer-collectblock', 'mineflayer-pvp'];
const versions = Object.fromEntries(packageNames.map(name => [name, JSON.parse(read(`mindcraft/node_modules/${name}/package.json`)).version]));
const sourceSpecs = {
  api: ['mineflayer/index.d.ts', ['  blockAt:', '  equip:', '  activateItem:', '  moveVehicle:', '  openAnvil:', 'export class EnchantmentTable', '  entityCriticalEffect:']],
  itemUse: ['mineflayer/lib/plugins/inventory.js', ['  function activateItem', '  function deactivateItem', '  async function activateEntity', '  async function activateEntityAt']],
  vehicle: ['mineflayer/lib/plugins/entities.js', ['  function mount', '  function moveVehicle', '  function dismount']],
  controls: ['mineflayer/lib/plugins/physics.js', ['  bot.setControlState', "  bot.on('mount'"]],
  anvil: ['mineflayer/lib/plugins/anvil.js', ['    async function combine', '    async function rename']],
  enchant: ['mineflayer/lib/plugins/enchantment_table.js', ['    async function enchant', '    async function putTargetItem', '    async function putLapis']],
  fish: ['mineflayer/lib/plugins/fishing.js', ["  bot._client.on('world_particles'", '  async function fish']],
  item: ['prismarine-item/index.js', ['        this.components = []', '          item.components = networkItem.components']],
  itemTypes: ['prismarine-item/index.d.ts', ['  durabilityUsed:', '  get enchants()', '  customName:']],
  pathfinder: ['mineflayer-pathfinder/index.d.ts', ['\t\tgoto(', '\t\tstop():', '\t\tsetMovements(']],
  collect: ['mineflayer-collectblock/lib/CollectBlock.d.ts', ['    collect(', '    cancelTask(']],
  pvp: ['mineflayer-pvp/lib/PVP.d.ts', ['    attack(', '    stop(']],
  windows: ['prismarine-windows/index.d.ts', ['    inventoryStart:', '    updateSlot(', '    items():']]
};
const sources = Object.fromEntries(Object.entries(sourceSpecs).map(([id, [suffix, needles]]) => {
  const path = 'mindcraft/node_modules/' + suffix;
  const content = read(path), lines = content.split(/\r?\n/);
  const anchors = needles.map(symbol => {
    const i = lines.findIndex(line => line.includes(symbol));
    assert(i >= 0, `${id}: missing source anchor ${symbol}`);
    return { symbol: symbol.trim(), line: i + 1 };
  });
  return [id, { path, sha256: hash(content), anchors }];
}));
const libraryPath = 'mindcraft/src/agent/library/skills.js';
const libraryText = read(libraryPath), libraryLines = libraryText.split(/\r?\n/);
const bridgeSpecs = [
  ['gather.collect', ['collectBlock', 'pickupNearbyItems'], '采集返回需统一为真实拾取数量，并加许可区域、工具和取消检查。'],
  ['craft.make', ['craftRecipe'], '核对num语义与产量换算；材料不足不能自动虚报成功。'],
  ['furnace.smelt', ['smeltItem', 'clearNearestFurnace'], '最近熔炉选择需改为明确target，限制可取用容器。'],
  ['block.break', ['breakBlockAt'], '包含cheat模式/setblock路径，评测必须禁用且独立验证。'],
  ['block.place', ['placeBlock'], 'dontCheat默认false；需强制生存路径，并核对朝向和多格状态。'],
  ['inventory.equip', ['equip'], '包含creative生成物品路径，不能直接作为严格生存评测的可信封装。'],
  ['inventory.transfer', ['putInChest', 'takeFromChest', 'discard'], '由最近箱子/模糊物品名改为明确目标、数量、组件与许可范围。'],
  ['item.use', ['consume', 'useToolOn', 'useToolOnBlock'], '用工具、吃东西和定点交互语义不同，必须保留具体目标与结果证据。'],
  ['navigation.goto', ['goToPosition', 'goToGoal'], 'goToPosition存在cheat/tp路径；正常路径仍需保护约束和到达核验。'],
  ['villager.trade', ['showVillagerTrades', 'tradeWithVillager'], '动态身份/价格/索引匹配，重新核对交易结果。'],
  ['combat.melee', ['attackNearest', 'attackEntity', 'defendSelf'], '不能直接接入：必须加玩家禁伤和目标新鲜度；attackEntity以离开附近实体列表结束，不足以证明击杀。'],
  ['animal.interact', ['useToolOn'], '只能作为部分交互候选，不证明快乐恶魂/犰狳/剪装备已支持。']
];
const bridge = bridgeSpecs.map(([action_id, funcs, note_zh]) => ({ action_id, reuse_status: 'candidate_only_requires_contract_adaptation', source_path: libraryPath, functions: funcs.map(name => {
  const index = libraryLines.findIndex(line => new RegExp('export (?:async )?function ' + name + '\\(').test(line));
  assert(index >= 0, 'Missing Mindcraft function: ' + name);
  return { name, line: index + 1 };
}), note_zh }));
sources.mindcraftSkills = { path: libraryPath, sha256: hash(libraryText), anchors: bridge.flatMap(b => b.functions.map(f => ({ symbol: f.name, line: f.line }))) };

const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const str = { type: 'string', minLength: 1 };
const num = { type: 'number' };
const nonnegative = { type: 'number', minimum: 0 };
const integer = { type: 'integer', minimum: 0 };
const positive = { type: 'integer', minimum: 1 };
const bool = { type: 'boolean' };
const choice = (...values) => ({ type: 'string', enum: values });
const ref = name => ({ $ref: '#/definitions/' + name });
const item = { type: 'string', pattern: '^minecraft:[a-z0-9_]+$' };
const list = schema => ({ type: 'array', items: schema, minItems: 1 });
const definitions = {
  position: obj({ dimension: item, x: num, y: num, z: num }),
  blockPosition: obj({ dimension: item, x: { type: 'integer' }, y: { type: 'integer' }, z: { type: 'integer' } }),
  blockRef: obj({ kind: { const: 'block' }, position: ref('blockPosition'), expected_name: item }),
  entityRef: obj({ kind: { const: 'entity' }, session_id: str, entity_id: integer, uuid: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }, expected_name: item, observed_tick: integer }),
  slotRef: obj({ inventory_revision: integer, slot: integer, expected_item: item, expected_fingerprint: str }),
  target: { oneOf: [ref('blockRef'), ref('entityRef')] },
  itemCount: obj({ item, count: positive }),
  condition: obj({ kind: choice('inventory_at_least', 'block_state', 'position_near', 'dimension_is', 'entity_state', 'blueprint_matches', 'event_observed'), subject: str, expected: {}, max_age_ticks: integer }),
  checkpoint: obj({ plan_id: str, revision: integer, phase_id: str, goal: str, completed_steps: list(str), next_steps: list(str), resource_ledger: { type: 'object' }, world_landmarks: { type: 'array', items: ref('position') }, pending_action_ids: { type: 'array', items: str } }, ['plan_id', 'revision', 'phase_id', 'goal', 'completed_steps', 'next_steps', 'resource_ledger', 'world_landmarks', 'pending_action_ids'])
};
// Empty plans and fully completed plans are valid checkpoint states.
definitions.checkpoint.properties.completed_steps.minItems = 0;
definitions.checkpoint.properties.next_steps.minItems = 0;
const actions = [];
function action(name, label, kind, native, sourceIds, params, required, contract) {
  actions.push({ name, label_zh: label, layer: kind, implementation_status: 'spec_only',
    surface_audit: 'local_source_checked', gameplay_validation: 'not_run',
    native_calls_or_fields: native, source_ids: sourceIds,
    arguments_schema: obj(params, required), contract_zh: contract });
}
action('observe.snapshot', '读取可见状态', 'native_wrapper', ['bot.blockAt', 'bot.findBlocks', 'bot.entities', 'bot.inventory', 'bot.health', 'bot.food', 'bot.oxygenLevel', 'bot.experience', 'bot.game', 'Item.enchants', 'Item.components'], ['api', 'item', 'itemTypes'], { radius: { type: 'integer', minimum: 1, maximum: 64 }, include: list(choice('self', 'inventory', 'blocks', 'entities', 'window', 'effects')) }, ['radius', 'include'], '只返回公开给Agent的感知半径内、已加载数据。未加载和未解码字段返回unknown；禁止查询评测隐藏区域、全世界容器和服务器完整状态。');
action('navigation.goto', '到达位置', 'plugin_wrapper', ['bot.pathfinder.goto', 'bot.pathfinder.setMovements', 'bot.pathfinder.stop'], ['pathfinder'], { destination: ref('position'), tolerance: nonnegative, allow_break: bool, allow_place: bool }, ['destination', 'tolerance', 'allow_break', 'allow_place'], 'Movements必须套用保护区域、禁止破坏物、掉落风险和材料限制；默认不得私自挖穿建筑。到达容差后核验，pathfinder无路线返回NO_PATH。');
action('navigation.control', '短时移动与朝向', 'controller_required', ['bot.setControlState', 'bot.clearControlStates', 'bot.lookAt', 'bot.waitForTicks'], ['api', 'controls'], { controls: obj({ forward: bool, back: bool, left: bool, right: bool, jump: bool, sprint: bool, sneak: bool }, []), look_at: ref('position'), duration_ticks: positive }, ['controls', 'duration_ticks'], '限时控制；按物理刻运行，自动释放。水下、粉雪、潜行、坠落控制分别预验。LLM不逐刻调用。');
action('gather.collect', '采集指定资源', 'plugin_wrapper', ['bot.collectBlock.collect', 'bot.collectBlock.cancelTask', 'bot.dig', 'bot.pathfinder.goto'], ['collect', 'api', 'pathfinder'], { block_names: list(item), quantity: positive, region_id: str, tool_policy: choice('best_valid', 'silk_touch_required', 'preserve_target') }, ['block_names', 'quantity', 'region_id', 'tool_policy'], '区分挖掘数与实际拾取数，region必须是公开许可区域。背包满不得任意扔工具或存进未授权箱子。草方块须先查有效精准采集工具；原木累计采集来源由grader核实。');
action('block.break', '破坏单个方块', 'native_wrapper', ['bot.dig', 'bot.stopDigging', 'bot.digTime', 'bot.equip'], ['api'], { target: ref('blockRef'), required_tool: item }, ['target'], '重新读取方块和工具；保护检查后挖掘，完成后验证方块变化；dig完成不等于产物已拾取。');
action('block.place', '按朝向放置方块', 'controller_required', ['bot.placeBlock', 'bot.placeEntity', 'bot.lookAt', 'bot.setControlState'], ['api', 'controls'], { item, destination: ref('position'), support: ref('blockRef'), face: choice('up', 'down', 'north', 'south', 'east', 'west'), properties: { type: 'object' } }, ['item', 'destination', 'support', 'face', 'properties'], 'destination为整数格坐标；必须从相邻support+face解析，禁止把绝对目标坐标直接当placeBlock参数。原生placeBlock不保证朝向/含水/床双格等状态；放置后读回properties。');
action('inventory.equip', '装备物品', 'native_wrapper', ['bot.equip', 'bot.unequip', 'bot.setQuickBarSlot'], ['api'], { item, destination: choice('hand', 'off-hand', 'head', 'torso', 'legs', 'feet'), source: ref('slotRef') }, ['item', 'destination'], '读取实际槽位物品组件与耐久；卸装作为单独操作策略，不以装备成功代替盾牌举起。');
action('inventory.transfer', '背包与容器转移', 'native_wrapper', ['bot.openContainer', 'bot.transfer', 'bot.clickWindow', 'bot.putAway', 'Chest.deposit', 'Chest.withdraw', 'bot.toss'], ['api', 'windows'], { direction: choice('deposit', 'withdraw', 'rearrange', 'drop'), target: ref('target'), items: list(ref('itemCount')), destination_slot: integer }, ['direction', 'items'], '容器操作须有新鲜目标和独占窗口租约；rearrange需目标槽，drop需许可丢弃区域。逐次校验cursor与前后数量，不将移入箱子的物品再算最终背包持有。');
action('inventory.bundle', '收纳袋操作', 'experimental_controller', ['bot.clickWindow', 'Item.components', 'Item.componentMap'], ['api', 'item', 'windows'], { bundle_slot: ref('slotRef'), operation: choice('insert', 'extract'), items: list(ref('itemCount')) }, ['bundle_slot', 'operation', 'items'], '需1.21.6收纳袋窗口动作预验及bundle_contents解码；按堆叠权重计算容量。不能把bundle当普通箱子或仅修改本地组件。');
action('item.use', '使用手中物品', 'controller_required', ['bot.activateItem', 'bot.deactivateItem', 'bot.activateBlock', 'bot.activateEntity', 'bot.activateEntityAt', 'bot.consume'], ['api', 'itemUse'], { item, hand: choice('main', 'off'), mode: choice('air', 'block', 'entity', 'consume'), target: ref('target'), hold_ticks: integer, sneak: bool }, ['item', 'hand', 'mode', 'hold_ticks', 'sneak'], 'block/entity模式强制对应target。activateItem(true)可用副手，但activateBlock/activateEntity内部交互主手，副手定点交互未验证时返回UNSUPPORTED；禁止静默换手。雪球喂食须对实体交互，不能向幼体发射。');
action('craft.make', '按版本配方制作', 'native_wrapper', ['bot.recipesFor', 'bot.craft'], ['api'], { output: item, output_count: positive, crafting_table: ref('blockRef') }, ['output', 'output_count'], 'output_count是目标产物数；bot.craft的count是配方执行次数，须按每次产量换算并记录实际消耗/产出。区分2x2和工作台3x3，不对制箭台调用造箭GUI。材料不足交回规划器补齐。');
action('furnace.smelt', '熔炉处理', 'native_wrapper', ['bot.openFurnace', 'Furnace.putInput', 'Furnace.putFuel', 'Furnace.takeOutput'], ['api'], { target: ref('blockRef'), input: ref('itemCount'), fuel: ref('itemCount'), expected_output: ref('itemCount') }, ['target', 'input', 'fuel', 'expected_output'], '确认容器类型、燃料与配方；耗时期间监测燃料/输出/背包，取出后验数量，支持可恢复进度。');
action('brewing.brew', '酿造流程', 'controller_required', ['bot.openBlock', 'bot.transfer', 'bot.clickWindow'], ['api', 'windows'], { target: ref('blockRef'), recipe_id: str, bottles: positive }, ['target', 'recipe_id', 'bottles'], '没有专用openBrewingStand接口的核实证据；须版本化GUI槽位与酿造状态适配。区分药水类型、延长时长和实际瓶数，失败不得虚报完成。');
action('workstation.process', '特殊工作站操作', 'experimental_controller', ['bot.openBlock', 'bot.clickWindow', 'bot.transfer', 'bot.activateBlock'], ['api', 'windows'], { target: ref('blockRef'), workstation: choice('grindstone', 'cartography_table', 'stonecutter', 'smithing_table', 'crafter'), operation: choice('remove_noncurse_enchantments', 'scale_map', 'lock_map', 'select_recipe', 'upgrade', 'configure_crafter'), inputs: list(ref('itemCount')), recipe_id: str, enabled_slots: { type: 'array', uniqueItems: true, items: { type: 'integer', minimum: 0, maximum: 8 } } }, ['target', 'workstation', 'operation', 'inputs'], '逐种工作站定义合法operation、窗口类型、状态ID与槽位表；GUI识别失败立即停止。石切机选择配方、合成器禁用槽位不能假设clickWindow足够；缺少已验证公共API时报告UNSUPPORTED，不向LLM开放原始包。');
action('villager.trade', '检查并执行交易', 'native_wrapper', ['bot.openVillager', 'Villager.trades', 'bot.trade'], ['api'], { target: ref('entityRef'), input: ref('itemCount'), output: ref('itemCount'), executions: positive }, ['target', 'input', 'output', 'executions'], '从最新trades按物品组件/价格匹配动态tradeIndex，检验第二输入、库存、折扣和输出；不固定交易索引，不假定所有村民有评测地图指定交易。');
action('villager.manage_job', '村民职业与工作站', 'controller_required', ['bot.placeBlock', 'bot.dig', 'bot.entities', 'bot.openVillager'], ['api'], { target: ref('entityRef'), workstation: ref('blockRef'), operation: choice('assign', 'remove_job_site', 'verify_locked_profession') }, ['target', 'workstation', 'operation'], '摆放工作站不是职业成功证明；确认村民身份、工作时段和目标变化，已交易村民不可作为随意洗职业对象。未知职业元数据保留unknown。');
action('enchanting.enchant', '附魔台操作', 'native_wrapper', ['bot.openEnchantmentTable', 'EnchantmentTable.putTargetItem', 'EnchantmentTable.putLapis', 'EnchantmentTable.enchant', 'EnchantmentTable.takeTargetItem'], ['api', 'enchant'], { target: ref('blockRef'), item_slot: ref('slotRef'), choice_index: { type: 'integer', minimum: 0, maximum: 2 }, minimum_offer_level: integer }, ['target', 'item_slot', 'choice_index', 'minimum_offer_level'], '等候选就绪后校验offer、青金石和等级；槽位索引与显示等级不同。30级选项不等于消耗30级，也不保证精准采集。取出工具检查实际附魔。');
action('anvil.process', '铁砧修理附魔重命名', 'native_wrapper', ['bot.openAnvil', 'Anvil.combine', 'Anvil.rename', 'Item.anvil'], ['api', 'anvil'], { target: ref('blockRef'), first: ref('slotRef'), second: ref('slotRef'), rename: str }, ['target', 'first'], '有second调用combine，否则rename必填并调用rename；预算以工具先前惩罚、有效附魔兼容与实际XP为准。结果核对耐久、附魔、自定义名称。');
action('combat.melee', '计时近战', 'controller_required', ['bot.attack', 'bot.lookAt', 'bot.setControlState', 'bot.entity.attributes', 'bot.pvp.attack', 'bot.pvp.stop'], ['api', 'controls', 'pvp'], { target: ref('entityRef'), technique: choice('normal', 'cooldown', 'critical', 'mace_smash'), max_attacks: positive }, ['target', 'technique', 'max_attacks'], '所有打击执行前重新排除玩家和禁止目标。pvp插件仅是候选普通近战实现，不证明1.21.6暴击/重锤正确。冷却强度估计、下落状态和攻击距离需控制器；精确判分需服务器证据。');
action('combat.shoot', '弓弩射击', 'controller_required', ['bot.lookAt', 'bot.activateItem', 'bot.deactivateItem', 'bot.setQuickBarSlot', 'bot.entities'], ['api', 'itemUse', 'item'], { target: ref('target'), weapon: choice('minecraft:bow', 'minecraft:crossbow'), phase: choice('load', 'fire', 'load_and_fire'), max_shots: positive, minimum_charge_ticks: integer }, ['target', 'weapon', 'phase', 'max_shots', 'minimum_charge_ticks'], '本地按物理刻完成蓄力、释放、提前量和弹道；弩load必须保留装填状态供切槽验证。检查charged_projectiles等组件可读性；发送use_item不是射击命中证明。');
action('combat.shield', '定向举盾', 'controller_required', ['bot.equip', 'bot.activateItem(true)', 'bot.deactivateItem', 'bot.lookAt'], ['api', 'itemUse'], { threat: ref('entityRef'), duration_ticks: positive, max_damage: num }, ['threat', 'duration_ticks', 'max_damage'], '副手装备后持用并面向威胁，考虑起盾延迟和禁用；健康未减不能独自证明格挡，服务器记录正面弹射物格挡次数。退出释放持用状态。');
action('combat.parry', '弹射物反击', 'experimental_controller', ['bot.attack', 'bot.entities', 'bot.lookAt'], ['api'], { projectile: ref('entityRef'), max_attempts: positive }, ['projectile', 'max_attempts'], '仅对白名单可反击弹射物进行定时攻击；检查射线前方无玩家，拒绝泛化为攻击任意实体。恶魂死亡和Tears唱片必须另查反射来源链。');
action('movement.clutch', '坠落与风弹控制', 'experimental_controller', ['bot.entity', 'bot.activateBlock', 'bot.activateItem', 'bot.setControlState', 'bot.lookAt'], ['api', 'controls', 'itemUse'], { technique: choice('water_bucket', 'wind_charge'), landing: ref('position'), recover_water: bool }, ['technique', 'landing', 'recover_water'], '高频预测落点、在合法交互范围使用；不得依赖LLM网络往返逐刻救援。风弹起跳和重锤落击是不同操作，成功各自观察验证。');
action('vehicle.mount', '选择并乘坐载具', 'experimental_controller', ['bot.mount', 'bot.activateEntity', 'bot.activateEntityAt', 'bot.vehicle'], ['api', 'vehicle'], { target: ref('entityRef'), seat: choice('driver', 'passenger') }, ['target', 'seat'], '确认目标、许可、乘客与座位；不能从发出mount就认定取得驾驶位。多座位快乐恶魂须预验。');
action('vehicle.drive', '驾驶路径', 'experimental_controller', ['bot.moveVehicle', 'bot.lookAt', 'bot.setControlState'], ['api', 'vehicle', 'controls'], { vehicle: ref('entityRef'), waypoints: list(ref('position')), mode: choice('boat', 'minecart', 'horse', 'happy_ghast') }, ['vehicle', 'waypoints', 'mode'], '按载具分别实现；moveVehicle只提供left/forward。轨道运输也不等于自由驾驶。快乐恶魂上下/制动/座位与同步输入无已验证实现，预验前必须UNSUPPORTED，不伪造flyHappyGhast原生API。');
action('vehicle.dismount', '安全下乘', 'experimental_controller', ['bot.dismount', 'bot.vehicle', 'bot.setControlState'], ['api', 'vehicle', 'controls'], { landing_zone: ref('position'), maximum_fall_blocks: num }, ['landing_zone', 'maximum_fall_blocks'], '核验落脚点和高度，再退出并等实际乘客关系解除。当前newPlayerInputPacket分支dismount发送jump:true，必须专门核验1.21.6语义，不能推定已可用。');
action('animal.interact', '动物喂食装备与刷取', 'controller_required', ['bot.activateEntity', 'bot.activateEntityAt', 'bot.equip', 'bot.setControlState', 'bot.entities'], ['api', 'itemUse'], { target: ref('entityRef'), operation: choice('lure', 'breed', 'shear_wool', 'feed_snowball', 'equip_harness', 'equip_saddle', 'shear_equipment', 'brush', 'equip_wolf_armor', 'inspect_age'), held_item: item, sneak: bool }, ['target', 'operation', 'held_item', 'sneak'], '身份、年龄、主人和装备状态要读回，不能以实体ID永久记忆。喂食/装备交互不是攻击；1.21.6剪装备、刷犰狳需独立预验。');
action('animal.leash', '拴绳关系操作', 'experimental_controller', ['bot.activateEntity', 'bot.activateEntityAt', 'bot.equip', 'bot.setControlState', 'bot.entities'], ['api', 'itemUse'], { source: ref('entityRef'), holder: ref('entityRef'), operation: choice('attach', 'chain', 'detach_with_shears', 'load_boat', 'unload_cargo') }, ['source', 'operation'], 'chain须holder；记录身份关系图与距离，不把跟随误判为拴绳。动物互拴、船载货物、快乐恶魂吊运需要1.21.6控制与可观察关系验证；无法观察则unknown。');
action('world.portal', '点燃与穿越传送门', 'controller_required', ['bot.activateBlock', 'bot.pathfinder.goto', 'bot.game', 'bot.waitForTicks'], ['api', 'itemUse', 'pathfinder'], { portal_anchor: ref('position'), destination_dimension: item, operation: choice('ignite', 'enter') }, ['portal_anchor', 'destination_dimension', 'operation'], '只能正常生存交互；记录双向地标，等待实际dimension变化、chunk和实体就绪，清除旧路径/旧entity_id/窗口租约。禁止tp。');
action('world.redstone', '红石输入与状态反馈', 'controller_required', ['bot.activateBlock', 'bot.blockAt', 'bot.placeBlock'], ['api', 'itemUse'], { input: ref('blockRef'), operation: choice('toggle', 'pulse', 'observe'), pulses: positive, expected: list(ref('condition')) }, ['input', 'operation', 'expected'], '由真实红石网络响应；不是模拟器替世界改状态。读取powered/朝向/方块移动和容器流转；合成器脉冲需已完成GUI配置。');
action('world.archaeology', '持续刷扫可疑方块', 'controller_required', ['bot.activateBlock', 'bot.activateItem', 'bot.deactivateItem', 'bot.lookAt'], ['api', 'itemUse'], { target: ref('blockRef'), max_ticks: positive }, ['target', 'max_ticks'], '锁定具体可疑方块，验证持续使用与dusted等状态推进，不调用dig代替刷扫；持续包序列必须1.21.6预验，底层组合不能先宣称成功。');
action('trial.interact', '试炼与宝库交互', 'experimental_controller', ['bot.activateBlock', 'bot.consume', 'bot.blockAt', 'bot.entities'], ['api', 'itemUse'], { target: ref('blockRef'), operation: choice('observe_spawner', 'use_trial_key', 'use_ominous_key', 'drink_ominous_bottle') }, ['target', 'operation'], '仅负责原子观察/交互，不包办整场战斗。完成试炼与奖励来源由grader判断；normal/ominous宝库、钥匙类型和玩家使用资格须分开。');
action('world.wait_until', '有限等待与状态监测', 'controller_required', ['bot.waitForTicks', 'bot.blockAt', 'bot.entities'], ['api'], { condition: ref('condition'), check_interval_ticks: positive, maximum_ticks: positive }, ['condition', 'check_interval_ticks', 'maximum_ticks'], '用于生长、孵化、红石自然变化等，只等待不快进世界；记录主动/被动等待，必须受剩余wall预算约束，超时checkpoint并交回规划。');
action('world.fish', '抛竿与收竿', 'native_wrapper', ['bot.fish', 'bot.activateItem', 'bot.entities'], ['api', 'fish'], { max_casts: positive, desired_fish_count: positive }, ['max_casts', 'desired_fish_count'], '原生fish已含浮漂/粒子咬钩检测与收竿逻辑；仍需水域、鱼竿、超时清理、渔获拾取与数量验证，不把promise完成当捕到鱼。');
action('build.blueprint', '按蓝图建造与核验', 'controller_required', ['bot.placeBlock', 'bot.dig', 'bot.blockAt', 'bot.pathfinder.goto'], ['api', 'pathfinder'], { blueprint_id: str, origin: ref('position'), revision: integer, operation: choice('build_missing', 'inspect', 'repair_mismatch') }, ['blueprint_id', 'origin', 'revision', 'operation'], '从发布给Agent的蓝图解析方块清单、放置序与差异；只做允许的局部修复，不偷偷生成材料。restart从世界重建完成状态；改屋顶后不得继续旧revision放置。');
action('plan.checkpoint', '持久保存计划进度', 'planner_service', [], [], { checkpoint: ref('checkpoint') }, ['checkpoint'], '原子落盘保存结构化阶段与行动账本，不保存思维链或密钥。按动作后置条件推进，不以发出命令或聊天承诺当作完成。');
action('plan.resume', '重启后恢复计划', 'planner_service', [], [], { plan_id: str, expected_revision: integer }, ['plan_id', 'expected_revision'], '读持久状态并与当前世界、背包核对；未决action状态不明时先对账，禁止盲目重放交易/消耗类动作。');
action('plan.revise', '目标变更与重规划', 'planner_service', [], [], { plan_id: str, expected_revision: integer, new_goal: str, cancel_action_ids: { type: 'array', items: str } }, ['plan_id', 'expected_revision', 'new_goal', 'cancel_action_ids'], '先停止旧revision写动作并核对最终状态，再发布新revision。MC-49只变更屋顶材料，旧基座/门窗依照原蓝图约束。');
action('verify.local', '检查局部后置条件', 'native_wrapper', ['bot.blockAt', 'bot.inventory', 'bot.entities', 'bot.game'], ['api'], { conditions: list(ref('condition')) }, ['conditions'], '输出true/false/unknown及证据索引；只能判断Agent可观测条件，禁止给出隐藏grader判分或自行宣布整题通过。');
action('npc.say', '向玩家自然语言反馈', 'presentation_service', ['bot.chat'], ['api'], { text: { type: 'string', minLength: 1, maxLength: 240 }, purpose: choice('progress', 'question', 'completion', 'failure') }, ['text', 'purpose'], '只发送自然语言；原始工具名/参数/!命令/函数调用仅写内部日志。此接口不得充当游戏命令执行通道。');
action('action.status', '查询动作', 'orchestrator_service', [], [], { action_id: str }, ['action_id'], '查询已有动作状态，不重新执行；暴露progress、可恢复阶段和剩余预算。');
action('action.cancel', '取消动作', 'orchestrator_service', [], [], { action_id: str, reason: str }, ['action_id', 'reason'], '幂等取消并等待控制权/窗口释放；返回partial_effects，不能假定已经发送的使用/攻击包被撤销。');

const actionByName = Object.fromEntries(actions.map(a => [a.name, a]));
const requireWhen = (schema, field, values, required, properties = {}) => {
  schema.allOf ??= [];
  schema.allOf.push({ if: { properties: { [field]: { enum: values } }, required: [field] }, then: { required, properties } });
};
requireWhen(actionByName['item.use'].arguments_schema, 'mode', ['block'], ['target'], { target: ref('blockRef') });
requireWhen(actionByName['item.use'].arguments_schema, 'mode', ['entity'], ['target'], { target: ref('entityRef') });
requireWhen(actionByName['inventory.transfer'].arguments_schema, 'direction', ['deposit', 'withdraw'], ['target']);
requireWhen(actionByName['inventory.transfer'].arguments_schema, 'direction', ['rearrange'], ['destination_slot']);
requireWhen(actionByName['animal.leash'].arguments_schema, 'operation', ['chain'], ['holder']);
requireWhen(actionByName['world.redstone'].arguments_schema, 'operation', ['pulse'], ['pulses']);
requireWhen(actionByName['workstation.process'].arguments_schema, 'workstation', ['grindstone'], [], { operation: { const: 'remove_noncurse_enchantments' } });
requireWhen(actionByName['workstation.process'].arguments_schema, 'workstation', ['cartography_table'], [], { operation: { enum: ['scale_map', 'lock_map'] } });
requireWhen(actionByName['workstation.process'].arguments_schema, 'workstation', ['stonecutter'], ['recipe_id'], { operation: { const: 'select_recipe' } });
requireWhen(actionByName['workstation.process'].arguments_schema, 'workstation', ['smithing_table'], [], { operation: { const: 'upgrade' } });
requireWhen(actionByName['workstation.process'].arguments_schema, 'workstation', ['crafter'], ['enabled_slots'], { operation: { const: 'configure_crafter' } });
actionByName['anvil.process'].arguments_schema.anyOf = [{ required: ['second'] }, { required: ['rename'] }];
const groups = [];
function group(id, caps, names, note) { groups.push({ id, capabilities: caps.split(' '), actions: names.split(' '), note_zh: note }); }
group('resource', 'gather tool_selection item_collection reward_collection resource_planning durability_budget', 'gather.collect block.break inventory.equip inventory.transfer observe.snapshot', '采集与拾取分开计数，工具/附魔/耐久是前置条件。');
group('crafting', 'craft recipe_versioning workstation_selection', 'craft.make observe.snapshot', '配方按1.21.6解析；制箭台不是合成GUI。');
group('placement', 'place placement_order structure_activation', 'block.place verify.local', '多格结构、方向和触发顺序需明确验收；不允许直接写世界。');
group('blueprint', 'blueprint', 'build.blueprint block.place block.break verify.local', '蓝图构建/修复需逐格核验。');
group('verification', 'verify constraint', 'verify.local observe.snapshot', '核验只能读取Agent可见局部状态；保护规则由工具层强制执行。');
group('carving', 'carve_pumpkin', 'item.use observe.snapshot', '雕刻南瓜用剪刀交互，随后结构摆放另计。');
group('processing', 'smelt', 'furnace.smelt', '等真实加工完成后取出。');
group('brewing', 'brew', 'brewing.brew', '通用窗口需要独立槽位适配。');
group('containers', 'chest inventory_ui window_slots', 'inventory.transfer observe.snapshot', '窗口租约和数量转移核验；窗口槽位能力不等于所有工作站都需要调用。');
group('equipment', 'equip hotbar_switch offhand', 'inventory.equip observe.snapshot', '切换装备与实际物品使用分开。');
group('item_inspection', 'inspect_enchantments inspect_durability inspect_components', 'observe.snapshot', '附魔/耐久/带电弩组件需解码；unknown不同于空值。');
group('generic_interaction', 'use_item timed_item_use held_item_duration bucket composter waterlogging source_water kelp waxing axe_scrape block_state_transition campfire_cooking respawn_anchor', 'item.use block.place world.wait_until verify.local', '区分空气/方块/实体目标、主副手和使用时长；营火无熔炉GUI。');
group('agriculture', 'farm automatic_farm', 'block.break block.place item.use world.wait_until gather.collect', '观察成熟阶段，保留/补种根部，不加速自然生长。');
group('observation', 'entity_tracking world_state block_identification inspect_map inspect_player_state identity_tracking status_effects provenance_tracking combat_telemetry projectile_feedback projectile_tracking entity_age entity_lifecycle', 'observe.snapshot verify.local', '客户端可见快照是局部证据；归因、完整来源链和精确战斗强度由服务器grader补充。');
group('navigation', 'navigation swimming air_management door_air_pocket_java equipment_mechanics sneaking vibration_knowledge wool_occlusion dimension_knowledge', 'navigation.goto navigation.control inventory.equip item.use observe.snapshot', '行为知识由Agent/控制器负责；感知不额外泄露触发区域。');
group('portal', 'portal', 'world.portal navigation.goto', '维度切换清除旧会话对象并重新定位。');
group('animal', 'animal_luring feed_snowballs harness_equip saddle_equip shear_equipment brush_entity pet_owner_check animal_equipment', 'animal.interact inventory.equip observe.snapshot', '按动物与交互模式分支，不从通用右键推断全部玩法已支持。');
group('leash', 'leash_graph sneak_interact animal_transport shear_leash boat_loading cargo_unloading', 'animal.leash animal.interact navigation.control observe.snapshot', '拴绳图、船乘客和载货关系须版本实机验证。');
group('vehicle', 'vehicle boat_mount_control vehicle_dismount horse_control mount_seat_selection flight_control safe_dismount', 'vehicle.mount vehicle.drive vehicle.dismount observe.snapshot', '快乐恶魂三维输入与安全下乘存在明确工具缺口。');
group('trading', 'trade villager_job_site', 'villager.trade villager.manage_job observe.snapshot', '动态交易列表、锁职业与目标UUID；不假定预设贸易是普通世界规则。');
group('enchanting', 'enchant', 'enchanting.enchant observe.snapshot', '等级、原始组件与结果必须核验，不把随机附魔说成确定获得。');
group('anvil', 'anvil', 'anvil.process observe.snapshot', '铁砧与附魔台为不同接口。');
group('experience', 'xp_management', 'observe.snapshot', '规划XP与读取当前等级，不凭此自动添加附魔台/铁砧操作。');
group('special_windows', 'grindstone cartography stonecutter smithing crafter slot_enable_disable', 'workstation.process inventory.transfer observe.snapshot', '每个窗口独立预验，不能硬编码所有工作站共用槽位。');
group('ranged', 'bow_charge_release aim_ballistics aim_leading crossbow_load', 'combat.shoot inventory.equip observe.snapshot', '蓄力/装填/射击分阶段，局部闭环控制弹道与提前量。');
group('shield', 'shield_raise_lower face_threat reactive_control', 'combat.shield navigation.control observe.snapshot', '面向威胁并处理起盾时机；格挡次数为grader权威信号。');
group('melee', 'mob_combat melee_cooldown attack_timing jump_fall_timing mace_smash timed_attack mob_specific_tactics combat_resource_management', 'combat.melee navigation.control inventory.equip observe.snapshot', '共享禁止伤害玩家规则；冷却/暴击/重锤不能仅凭attack包判断。');
group('falling', 'fall_prediction wind_charge_movement', 'movement.clutch navigation.control observe.snapshot', '水桶/风弹需要物理刻闭环；不是LLM逐刻选按键。');
group('parry', 'projectile_parry', 'combat.parry observe.snapshot', '只反击白名单可反射弹射物，并验证反射伤害归属。');
group('redstone', 'redstone redstone_feedback hopper_orientation container_network redstone_logic piston_orientation observer', 'world.redstone block.place inventory.transfer verify.local', '构造方向和状态反馈，物流用真实漏斗，不能手搬冒充。');
group('archaeology', 'archaeology', 'world.archaeology inventory.equip observe.snapshot', '持续刷扫和掉落来源都需要实机预验。');
group('trials', 'trial_spawner vault ominous_trials', 'trial.interact combat.melee inventory.transfer observe.snapshot', '完整试炼完成与随机奖励/宝库身份判定由grader记录。');
group('growth', 'long_wait_monitoring', 'world.wait_until plan.checkpoint observe.snapshot', '记录真实被动等待，不超出任务wall预算。');
group('barter', 'barter mob_identification', 'item.use inventory.transfer observe.snapshot', '成年猪灵识别与金锭交互/投放、回报拾取和来源核验。');
group('bundle', 'bundle_components capacity_reasoning', 'inventory.bundle observe.snapshot', '独立容量计算与现代物品组件适配。');
group('fishing', 'fishing_bobber bite_detection', 'world.fish inventory.equip observe.snapshot', '复用原生fish检测，但仍核验实际渔获。');
group('healing', 'healing_management', 'item.use world.wait_until observe.snapshot', '食物/血量/效果和冷却按当前状态决策。');
group('planning', 'planning persistent_memory recovery dialogue replanning persistent_planning', 'plan.checkpoint plan.resume plan.revise action.status action.cancel npc.say', 'Mineflayer不提供长期规划与跨重启任务记忆，需Agent服务。');

const uniqueCaps = [...new Set(bench.tasks.flatMap(t => t.capabilities))].sort();
const mapping = {};
for (const g of groups) for (const cap of g.capabilities) {
  assert(!mapping[cap], `duplicate capability ${cap}`);
  for (const name of g.actions) assert(actionByName[name], `unknown action ${name}`);
  mapping[cap] = { group: g.id, action_ids: g.actions, note_zh: g.note_zh };
}
assert.deepEqual(Object.keys(mapping).sort(), uniqueCaps, 'Every existing capability must have exactly one explicit mapping');

const extra = {
  'MC-27': ['animal.interact'], 'MC-39': ['animal.interact'], 'MC-47': ['animal.interact'],
  'MC-59': ['world.redstone'], 'MC-68': ['movement.clutch'], 'MC-71': ['navigation.goto'],
  'MC-76': ['inventory.transfer'], 'MC-77': ['navigation.control'],
  'MC-79': ['navigation.control'], 'MC-80': ['item.use'],
  'MC-81': ['combat.shoot', 'combat.shield'], 'MC-83': ['item.use', 'combat.shoot', 'combat.shield'],
  'MC-84': ['combat.melee'], 'MC-86': ['item.use'], 'MC-87': ['world.wait_until'],
  'MC-89': ['navigation.goto'], 'MC-90': ['vehicle.mount', 'vehicle.drive', 'vehicle.dismount'],
  'MC-91': ['vehicle.mount', 'vehicle.dismount'], 'MC-94': ['inventory.transfer'],
  'MC-96': ['item.use'], 'MC-98': ['inventory.transfer'],
  'MC-99': ['combat.melee', 'inventory.equip', 'inventory.transfer'],
  'MC-100': ['animal.interact', 'vehicle.mount', 'vehicle.dismount']
};
const gapNotes = {
  'MC-35': '酿造GUI与效果组件需预验。', 'MC-37': '轨道运输须核验乘客/下乘，不能直接套快乐恶魂控制。',
  'MC-44': '延长药水的效果/时长组件须预验。', 'MC-48': '跨重启账本、未决动作对账和世界重建不由Mineflayer提供。',
  'MC-49': '目标revision变更与取消旧建造动作是Agent职责。', 'MC-50': '精准采集书/工具/掉落来源闭环；不得以挖掉草方块代替获得草方块。',
  'MC-51': '制箭台不提供玩家造箭GUI，正确动作是普通工作台craft。',
  'MC-54': '砂轮槽位与诅咒保留需要专门GUI适配。', 'MC-55': '地图缩放/锁定组件和制图台GUI需要预验。',
  'MC-56': '石切机配方选择不是普通合成操作。', 'MC-58': '锻造台模板/材料/底材槽位与输出核验。',
  'MC-59': '合成器禁用槽位、装料和红石脉冲分开；缺少可靠槽位切换实现。',
  'MC-63': '需解码带电弹射物组件，以装填后切槽仍保留为证据。',
  'MC-64': '必须验证正面起盾和服务器格挡归因。', 'MC-65': '动态转向与本地反应循环，不能依赖LLM延迟。',
  'MC-66': '原生attack不等待完整冷却，pvp插件也未在本任务实机验收。', 'MC-67': 'entityCriticalEffect是粒子/状态提示，不足以单独证明本次合法暴击。',
  'MC-68': '高频水桶落地与收水需独立控制器。', 'MC-69': '乘客关系、船控制及下乘需预验。',
  'MC-76': '持续刷扫交互序列未验证，不能dig。', 'MC-80': '客户端未必公开权威重生绑定点，须grader核对。',
  'MC-81': 'spawner状态与奖励关联需要服务器证据。', 'MC-82': '宝库每人资格不可由客户端通用blockstate完整读取。',
  'MC-83': '灾厄效果到不祥试炼转换需要版本状态核验。', 'MC-84': '风弹轨迹、重锤下落伤害和安全落地需本地控制+服务器判分。',
  'MC-85': '不能用发出箭矢就算对旋风人造成有效远程伤害。',
  'MC-86': '实体生命周期、加载状态和真实等待须验证，不能把未加载当消失。',
  'MC-87': '幼体是happy_ghast的年龄状态，不存在独立ghastling实体ID；雪球是喂食交互。',
  'MC-88': '快乐恶魂三维驾驶、座位选择和下乘属于明确工具缺口。',
  'MC-89': '动物互拴与剪绳关系图需1.21.6预验。', 'MC-90': '配方已查不等于马匹驯服/驾驶/剪鞍均已实现。',
  'MC-91': '船载牛、吊运拴绳、快乐恶魂飞行和卸载全部需实机闭环。',
  'MC-92': '反射弹射物击杀到Tears唱片的来源链须服务器核实。',
  'MC-94': '主人、幼成体、刷子耐久和装备回读不能省略。',
  'MC-95': '收纳袋需要bundle_contents解码与窗口操作，不能当普通箱子。',
  'MC-98': '原生fish返回只代表流程结束，不保证已拾取计分鱼。',
  'MC-99': '营火用方块交互无熔炉GUI，料理掉落需要拾取。',
  'MC-100': '空手生存依赖图很长，包含快乐恶魂飞行工具缺口；仍计入100题失败分母。'
};
const sharedActions = ['observe.snapshot', 'verify.local', 'action.status', 'action.cancel'];
const taskMap = bench.tasks.map(t => {
  const declared = [...new Set(t.capabilities.flatMap(c => mapping[c].action_ids))];
  const common = ['navigation.goto', 'inventory.equip'];
  const additions = extra[t.id] || [];
  const names = [...new Set([...sharedActions, ...common, ...declared, ...additions])].sort();
  const predicates = t.success_all.map((p, i) => ({
    predicate_id: p.check_id || `${t.id}:success_all:${i}`,
    benchmark_json_pointer: `/tasks/${Number(t.id.slice(3)) - 1}/success_all/${i}`,
    predicate_sha256: hash(JSON.stringify(p)),
    client_evidence: p.kind === 'mechanic_check' ? 'partial_or_unknown_requires_predicate_specific_preflight' : 'partial_local_observations_only',
    authoritative_source: 'grader_server_and_episode_provenance',
    validator_implementation: 'not_implemented'
  }));
  return {
    task_id: t.id, title: t.title, level: t.level,
    track: t.track || 'core_survival', benchmark_task_sha256: hash(JSON.stringify(t)),
    declared_capabilities: t.capabilities,
    capability_bindings: t.capabilities.map(capability => ({ capability, ...mapping[capability] })),
    common_actions: [...sharedActions, ...common], supplementary_actions: additions,
    action_ids: names,
    experimental_actions: names.filter(n => actionByName[n].layer === 'experimental_controller'),
    native_or_plugin_surface_only: names.filter(n => ['native_wrapper', 'plugin_wrapper'].includes(actionByName[n].layer)),
    predicate_bindings: predicates,
    evidence_policy: 'E1_client_partial_plus_E2_server_authoritative; do_not_expose_E2_to_agent',
    note_zh: gapNotes[t.id] || '按原任务条件验收；接口存在仅是调用面证据，整题尚未实机验证。',
    integration_preflight: 'not_run', task_support_claim: 'not_established'
  };
});

const errorCodes = ['INVALID_ARGUMENT', 'VERSION_MISMATCH', 'UNSUPPORTED', 'UNOBSERVABLE', 'STALE_TARGET', 'STALE_REVISION', 'PRECONDITION_FAILED', 'PROTECTED_TARGET', 'PLAYER_DAMAGE_RISK', 'NO_PATH', 'MISSING_ITEM', 'INVENTORY_FULL', 'WINDOW_MISMATCH', 'BUSY', 'TIMEOUT', 'POSTCONDITION_FAILED', 'CONNECTION_LOST', 'INDETERMINATE', 'CANCELLED'];
const requestSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#', title: 'MC-NPC proposed action request v0.3',
  ...obj({ protocol_version: { const: '0.3-spec' }, episode_id: str, session_id: str, action_id: str, plan_id: str, plan_revision: integer, deadline_ms: positive, max_ticks: positive, name: choice(...actions.map(a => a.name)), arguments: { type: 'object' } }),
  definitions: { ...definitions, ...Object.fromEntries(actions.map(a => ['args_' + a.name, a.arguments_schema])) },
  allOf: actions.map(a => ({ if: { properties: { name: { const: a.name } }, required: ['name'] }, then: { properties: { arguments: ref('args_' + a.name) } } }))
};
const effectSchema = obj({ kind: str, subject: str, before: {}, after: {}, evidence_ids: { type: 'array', items: str } });
const evidenceSchema = obj({ evidence_id: str, channel: choice('client', 'controller_estimate'), observation_type: str, server_tick: { type: ['integer', 'null'], minimum: 0 }, client_tick: integer, data: {}, uncertainty: choice('observed', 'estimated', 'unknown') });
const resultSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#', title: 'MC-NPC proposed agent-visible action result v0.3',
  ...obj({ protocol_version: { const: '0.3-spec' }, episode_id: str, session_id: str, action_id: str, name: choice(...actions.map(a => a.name)), plan_id: str, plan_revision: integer,
    status: choice('accepted', 'running', 'succeeded', 'failed', 'cancelled', 'indeterminate'),
    progress: { type: 'number', minimum: 0, maximum: 1 }, elapsed_ms: integer, elapsed_client_ticks: integer,
    local_postconditions: { type: 'array', items: obj({ predicate: str, value: choice('true', 'false', 'unknown'), evidence_ids: { type: 'array', items: str } }) },
    effects: { type: 'array', items: effectSchema }, evidence: { type: 'array', items: evidenceSchema },
    error: { oneOf: [{ type: 'null' }, obj({ code: choice(...errorCodes), message: str, retryable: bool, retry_after_ms: integer }, ['code', 'message', 'retryable'])] },
    cleanup: obj({ owned_controls_released: bool, owned_window_closed: bool, held_item_use_released: bool, lease_released: bool }),
    checkpoint_id: { type: ['string', 'null'] }
  }),
  allOf: [{ if: { properties: { status: { enum: ['failed', 'indeterminate'] } } }, then: { properties: { error: { type: 'object' } } } }, { if: { properties: { status: { const: 'succeeded' } } }, then: { properties: { error: { type: 'null' } } } }]
};
json('action-request.schema.json', requestSchema);
json('action-result.schema.json', resultSchema);
json('action-catalog.json', { version: '0.3-spec', status: 'Specification only; all wrappers unimplemented', definitions, actions });
json('capability-interface-map.json', { version: '0.3-spec', capability_count: uniqueCaps.length, groups, capabilities: mapping });
json('mindcraft-bridge-candidates.json', { version: '0.3-spec', implemented: false, source_path: libraryPath, candidates: bridge });
json('task-interface-map.json', { version: '0.3-spec', benchmark_path: '../v0.2/tasks-100.json', benchmark_sha256: hash(original), task_count: 100, all_tasks_preserved: true, shared_actions: sharedActions, tasks: taskMap });
json('source-audit.json', { date: '2026-10-28', target_game_version: '1.21.6', audit_scope: 'installed local source including local patches; no runtime capability claims', versions, sources, constraints: ['No game or API calls', 'No Agent source or settings edits', 'No implementation of wrappers, grader, runner, world pack'], special_findings: ['moveVehicle exposes only left/forward; no verified happy-ghast 3D controller', 'dismount newPlayerInputPacket branch sends jump:true; must preflight', 'activateItem supports offhand, targeted activateBlock/activateEntity interactions use main hand', 'fish already detects bobber particles and reels in; result collection still separate', 'entityCriticalEffect exists but is not sufficient proof of attributed valid critical damage', 'item JS exposes components/componentMap though d.ts is incomplete'] });

const examples = [
  { protocol_version: '0.3-spec', episode_id: 'mc61-A-run01', session_id: 'session-001', action_id: 'action-001', plan_id: 'archery-01', plan_revision: 0, deadline_ms: 15000, max_ticks: 200, name: 'combat.shoot', arguments: { target: { kind: 'block', position: { dimension: 'minecraft:overworld', x: 16, y: 65, z: 0 }, expected_name: 'minecraft:target' }, weapon: 'minecraft:bow', phase: 'load_and_fire', max_shots: 1, minimum_charge_ticks: 20 } },
  { protocol_version: '0.3-spec', episode_id: 'mc64-A-run01', session_id: 'session-002', action_id: 'action-002', plan_id: 'shield-01', plan_revision: 0, deadline_ms: 10000, max_ticks: 120, name: 'combat.shield', arguments: { threat: { kind: 'entity', session_id: 'session-002', entity_id: 37, uuid: '00000000-0000-4000-8000-000000000037', expected_name: 'minecraft:skeleton', observed_tick: 230 }, duration_ticks: 80, max_damage: 4 } }
];
json('request-examples.json', examples);
const resultExample = { protocol_version: '0.3-spec', episode_id: 'mc88-A-run01', session_id: 'session-003', action_id: 'action-003', name: 'vehicle.drive', plan_id: 'flight-01', plan_revision: 0, status: 'failed', progress: 0, elapsed_ms: 0, elapsed_client_ticks: 0, local_postconditions: [], effects: [], evidence: [], error: { code: 'UNSUPPORTED', message: '快乐恶魂三维驾驶控制器尚未通过1.21.6预验。', retryable: false }, cleanup: { owned_controls_released: true, owned_window_closed: true, held_item_use_released: true, lease_released: true }, checkpoint_id: null };
json('result-example.json', resultExample);

md('Mineflayer接口规范.md', `# MC-NPC-100：Mineflayer 接口规范 v0.3

本文只定义接口与评测映射，不接入或修改现有 Agent。原始50题与扩展100题均保留。目标 Java 1.21.6；核对日期2026-10-28。

## 1. 核对范围与结论

本地安装：${Object.entries(versions).map(([k,v])=>k+' '+v).join('；')}。以安装目录的实际源码（包含本地补丁）为准，版本和文件SHA-256见[源码核对记录](source-audit.json)。调用面已查证；游戏行为、性能、控制成功率和整题可完成性均未实机验证。

| 层次 | 本文含义 | 不能据此认定 |
|---|---|---|
| native_wrapper | 对已查到的原生调用做规范化封装 | 封装已经写好或任务已通过 |
| plugin_wrapper | 已安装插件暴露相关接口 | 插件适配了所有1.21.6机制 |
| controller_required | 有基础调用，需局部状态机或闭环 | 单次调用能完成玩法 |
| experimental_controller | 特殊协议/GUI/物理尚有缺口 | 可直接列为“已支持” |
| planner_service / presentation_service / orchestrator_service | Agent计划、聊天和调度层 | Mineflayer原生提供长期规划 |

${actions.length}个拟议操作以[action-catalog.json](action-catalog.json)为唯一命名与参数依据；它们都尚未实现。具体数量由[静态检查](validation.json)给出。禁止将拟议接口名称写成Mineflayer已有方法。

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

映射保留${uniqueCaps.length}种原能力名并全部绑定操作。action_ids是相关操作集合，包含不同可行路径，不是每次都必须调用的最小动作序列；规划器仍根据当前状态选择。common_actions是统一观察/导航/装备/调度设施；supplementary_actions补上原标签未完整表达的交互，不改原任务正文。逐题人读表见[100题接口映射](100题接口映射.md)。

## 10. 预验与发布门槛

本次只做静态核对：100题和原条件哈希完整、能力名全覆盖、动作引用存在、请求/结果schema可编译、示例可验证、旧文件与Agent未改。所有物理、协议、GUI、世界fixture和grader检查均not_run。

后续实现顺序：先统一读状态/身份/动作生命周期；再采集/制作/熔炼/容器与蓝图；随后交易/附魔/铁砧；再弓弩盾/计时近战；最后特殊GUI、考古、收纳袋及1.21.6载具。逐操作跑固定fixture，明确输入、结果和失败清理，再组合任务。仅接口预验失败不应误归为模型规划失败，但tool_gap仍按原协议留在任务成功率分母，并单列原因。

错误码定义见[动作目录](action-catalog.json)对应契约与result schema枚举。可重试仅限已知无副作用的短暂状态；UNSUPPORTED、VERSION_MISMATCH、PLAYER_DAMAGE_RISK不能盲目循环重试。INDETERMINATE先对账，TIMEOUT必须输出部分效果与清理状态。
`);

const layerLabels = { native_wrapper: '原生封装', plugin_wrapper: '插件封装', controller_required: '需控制器', experimental_controller: '实验/缺口', planner_service: '规划服务', presentation_service: '聊天服务', orchestrator_service: '调度服务' };
md('100题接口映射.md', `# MC-NPC-100：逐题接口映射 v0.3

原任务100项全部保留；本表不代表Agent已具备这些能力。机器映射见[task-interface-map.json](task-interface-map.json)，参数契约见[接口规范](Mineflayer接口规范.md)与[动作目录](action-catalog.json)。

每题默认有observe.snapshot、verify.local、navigation.goto、inventory.equip及动作查询/取消设施。下面省略这些共用项，仅列该题其余操作。“实验操作”强调接口缺口；未列为实验的操作也尚未接入、尚未实机验证。E2服务器证据必须独立记录，不能返给Agent作为额外观测。

## 原有50题

| ID | 任务 | 相关接口（共用项省略） | 实验操作 | 关键核验与缺口 |
|---|---|---|---|---|
${taskMap.slice(0,50).map(t=>`| ${t.task_id} | ${t.title} | ${t.action_ids.filter(x=>![...sharedActions,'navigation.goto','inventory.equip'].includes(x)).join('<br>')} | ${t.experimental_actions.join('<br>')||'—'} | ${t.note_zh} |`).join('\n')}

## 新增50项游玩专项

| ID | 任务 | 相关接口（共用项省略） | 实验操作 | 关键核验与缺口 |
|---|---|---|---|---|
${taskMap.slice(50).map(t=>`| ${t.task_id} | ${t.title} | ${t.action_ids.filter(x=>![...sharedActions,'navigation.goto','inventory.equip'].includes(x)).join('<br>')} | ${t.experimental_actions.join('<br>')||'—'} | ${t.note_zh} |`).join('\n')}

## 操作调用面索引

| 拟议操作 | 层次 | 查到的原生/插件接口 | 说明 |
|---|---|---|---|
${actions.map(a=>`| ${a.name} | ${layerLabels[a.layer]} | ${a.native_calls_or_fields.join('<br>')||'无，属于Agent服务'} | ${a.contract_zh} |`).join('\n')}

## 全部能力覆盖

| 能力组 | 原始能力名 | 接口 | 边界 |
|---|---|---|---|
${groups.map(g=>`| ${g.id} | ${g.capabilities.join('<br>')} | ${g.actions.join('<br>')} | ${g.note_zh} |`).join('\n')}

## 如何使用此映射

开发者先按action-catalog逐个实现并验证控制器，再让Agent通过同一菜单调用；不能把整份“题号→动作”答案表塞给待测模型。允许公布通用工具说明和开发集任务；held-out测试任务的精确依赖/解法、fixture坐标与E2判分保持隐藏。MC-100等完整生存链在飞行控制未验证前标tool_gap，不删除，不记为已支持。

predicate_bindings保存每条success_all的JSON Pointer、条件哈希和权威证据来源；这保证接口改版可追踪原条件，而非提供已实现的grader。特殊中文mechanic_check仍需逐条件转成服务器事件/状态判定，不能仅用LLM打分。
`);
md('README.md', `# MC-NPC-100 v0.3：接口规范与benchmark映射

仅文档/数据规范，未实现或接入Agent。目标Java1.21.6，实际源码核对Mineflayer ${versions.mineflayer}。

- [接口规范](Mineflayer接口规范.md)：分层、参数、生命周期、证据、禁攻击玩家、聊天隐藏命令与长程状态。
- [100题接口映射](100题接口映射.md)：保留全部题目，逐题列操作与工具缺口。
- [动作目录](action-catalog.json)：${actions.length}个拟议操作及输入契约，全部spec_only。
- [能力映射](capability-interface-map.json)：${uniqueCaps.length}种原能力全部映射。
- [现有Mindcraft技能候选](mindcraft-bridge-candidates.json)：旧函数到新接口的对接位置及缺口。
- [逐题机器映射](task-interface-map.json)：100题及每条success_all绑定。
- [请求schema](action-request.schema.json)、[结果schema](action-result.schema.json)、[请求示例](request-examples.json)、[结果示例](result-example.json)。
- [源码核对](source-audit.json)、[静态检查](validation.json)。

原始100题仍在[上一版tasks-100.json](../v0.2/tasks-100.json)；蓝图与50题协议仍在上层目录。build-interfaces.mjs只是生成这些文档，不连接游戏、不调用模型、不实现任何控制器。当前Agent行为没有改变。
`);

// Validate the actual artifacts with the locally installed JSON Schema compiler.
const require = createRequire(new URL('../../mindcraft/package.json', here));
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });
const checkRequest = ajv.compile(requestSchema), checkResult = ajv.compile(resultSchema);
for (const e of examples) assert(checkRequest(e), JSON.stringify(checkRequest.errors));
assert(checkResult(resultExample), JSON.stringify(checkResult.errors));
const bad = JSON.parse(JSON.stringify(examples[0]));
bad.arguments.weapon = 'minecraft:shield';
assert(!checkRequest(bad), 'Wrong weapon must fail');
const badUnknown = { ...examples[0], name: 'bot.flyHappyGhast' };
assert(!checkRequest(badUnknown), 'Invented raw API must fail');
assert.equal(taskMap.length, 100);
assert.deepEqual(bench.tasks.slice(0, 50), JSON.parse(read('benchmark-design/tasks-50.json')).tasks);
assert.equal(new Set(taskMap.map(t=>t.task_id)).size,100);
assert.equal(taskMap.reduce((s,t)=>s+t.predicate_bindings.length,0), bench.tasks.reduce((s,t)=>s+t.success_all.length,0));
assert.equal(read('benchmark-design/v0.2/tasks-100.json'), original);
for (const [p, h] of Object.entries(frozen)) assert.equal(hash(read(p)), h, 'Changed protected prior file: ' + p);
for (const t of taskMap) {
  for (const a of t.action_ids) assert(actionByName[a]);
  assert.equal(hash(JSON.stringify(bench.tasks.find(b=>b.id===t.task_id))), t.benchmark_task_sha256);
}
const validation = { scope: 'static specification validation only', date: '2026-10-28', task_count: taskMap.length, capability_count: uniqueCaps.length, action_count: actions.length, predicate_count: taskMap.reduce((s,t)=>s+t.predicate_bindings.length,0),
  checks: { all_100_original_task_objects_preserved: true, all_success_predicates_bound: true, every_original_capability_mapped_once: true, all_action_references_resolve: true, schema_compilation: 'passed', valid_examples: 'passed', invalid_weapon_and_invented_api_rejected: true, prior_benchmark_files_byte_unchanged: true, tracked_agent_settings_and_library_files_unchanged: true },
  protected_file_hashes: frozen, not_run: ['Agent integration', 'Minecraft connection', 'Model API call', 'GUI interaction', 'Combat or vehicle controller', 'World fixture preflight', 'Server grader', 'End-to-end task success'], no_capability_success_claims: true };
json('validation.json', validation);
console.log(JSON.stringify({ tasks:100, capabilities:uniqueCaps.length, actions:actions.length, predicates:validation.predicate_count, schemas:'passed', prior_files:'unchanged', gameplay:'not_run' }));
