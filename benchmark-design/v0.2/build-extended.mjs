import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const mc=require('../../mindcraft/node_modules/minecraft-data')('1.21.6');
const baseUrl=new URL('../tasks-50.json',import.meta.url);
const baseText=readFileSync(baseUrl,'utf8');
const base=JSON.parse(baseText);
const baselineFiles=['tasks-50.json','blueprints.json','任务清单.md','评测协议.md','build-design.mjs','validation.json'];
const sha=text=>createHash('sha256').update(text).digest('hex');
const baselineHashes=Object.fromEntries(baselineFiles.map(name=>[name,sha(readFileSync(new URL('../'+name,import.meta.url)))]));
const release='https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-6';
const trials='https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21';
const sources={
 fletching:'https://www.minecraft.net/en-us/article/block-month--fletching-table',
 bow:'https://www.minecraft.net/en-us/article/taking-inventory--bow',
 crossbow:'https://www.minecraft.net/en-us/article/taking-inventory--crossbow',
 shield:'https://www.minecraft.net/en-us/article/taking-inventory--shield',
 release,trials,
 ghast:'https://www.minecraft.net/de-de/article/happy-ghast',
 ghast_growth:'https://www.minecraft.net/en-us/article/take-on-ghastastic-challenges',
 saddle:'https://www.minecraft.net/en-us/article/minecraft-snapshot-25w20a',
 campfire:'https://www.minecraft.net/fr-fr/article/taking-inventory--campfire',
 wolf:'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5',
 bundle:'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-2',
 archaeology:'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20',
 source_boundary:'Release notes are version anchors. Individual interaction rules not explicitly documented by them require Java 1.21.6 world preflight; snapshots and later feature articles cannot override the target release.'
};
const added=[];
function add(id,level,category,title,prompt,kit,fixtures,checks,skills,trap,sourceKeys=[],introduced='available_in_1.21.6'){
 added.push({id:`MC-${id}`,level,category,title,player_prompt:prompt,
  track: Object.keys(kit).length?'mechanic_execution':'survival_chain',
  initial_inventory:kit,initial_equipment:{},initial_xp_level:0,
  fixture_requirements:fixtures,
  success_all:checks.map((text,i)=>({kind:'mechanic_check',check_id:`MC-${id}-${i+1}`,expectation_zh:text})),
  capabilities:skills,common_failure:trap,
  version_scope:{edition:'Java',version:'1.21.6',introduced},
  references:sourceKeys.map(key=>sources[key]),
  budget:{wall_time_seconds:[600,1200,2100,3600,5400][level-1],model_calls:[30,60,100,160,240][level-1]},
  required_evidence:['server-side action and interaction events','before/after world, item-component and entity snapshots','agent identity and item/projectile provenance'],
  preflight_status:'not_run'
 });
}

add(51,1,'工作站与村民','制箭台边界与制箭','附近有制箭台。请用给定的燧石、木棍和羽毛制作16支普通箭，并保留。',{flint:4,stick:4,feather:4},['fletching_table_decoy','oak_tree','clear_work_area'],[
 '本回合以合法配方制作产出至少16支arrow，终止时背包至少16支。',
 '未以不存在的制箭台配方或虚构GUI结果作为完成证据。'
],['craft','workstation_selection'],'反复右击制箭台，幻想存在箭矢合成GUI。',['fletching']);
add(52,2,'工作站与村民','制箭师职业与交易','让标记的无业村民成为制箭师，并通过交易获得2颗绿宝石。',{fletching_table:1,stick:64},['adult_unemployed_non_nitwit_untraded_villager','isolated_job_site','daytime_fixed_trade_stock'],[
 '同一指定村民从无业转为fletcher，并绑定Agent放置的制箭台。',
 '由该村民的木棍交易获得至少2颗emerald；没有提供初始绿宝石。'
],['place','villager_job_site','trade'],'对幼年村民、傻子村民或已锁定职业的村民反复放工作站。',['fletching']);
add(53,2,'工作站与村民','识别交易后的职业锁定','A是已交易过的制箭师，B是未交易过的无业成年村民。请让B成为图书管理员，保留A的职业。',{lectern:1},['villager_A_traded_fletcher','villager_B_unemployed_untraded','no_other_job_sites'],[
 'B最终为librarian且与新讲台建立工作站关联。',
 'A保持fletcher，未被伤害；Agent未把仅放置讲台误报为职业已改变。'
],['entity_tracking','villager_job_site','constraint'],'试图让已完成交易的A改职业，或混淆两个实体。');
add(54,2,'工作站与村民','砂轮与诅咒边界','使用砂轮去掉这把铁镐的普通附魔，保留工具，不要丢弃它。',{iron_pickaxe:1},['grindstone','iron_pickaxe_with_unbreaking_I_and_vanishing_curse'],[
 '原铁镐的耐久I被移除，消失诅咒仍存在，工具未被替换。',
 '有真实砂轮交互和输出领取事件，未把未去掉诅咒误报为失败或不断重复处理。'
],['grindstone','window_slots','inspect_enchantments'],'认为砂轮能移除所有诅咒；只看物品名字不看附魔数据。');
add(55,2,'工作站与村民','制图台扩图与锁图','把给定地图扩展一级，然后锁定它并保留。',{filled_map:1,paper:1,glass_pane:1},['cartography_table','filled_map_scale_0_unlocked'],[
 '得到同一地图区域谱系的scale=1地图，不能交付其他预制地图。',
 '最终地图locked=true，并有扩图后再锁图的交互顺序证据。'
],['cartography','window_slots','inspect_map'],'先锁图导致不能扩图，或把空地图当作已绘制地图。');
add(56,2,'工作站与村民','切石机材料效率','只有6块石头，请做出6个石楼梯，不能再采石。',{stone:6},['stonecutter','protected_stone_region'],[
 '通过切石机获得6个stone_stairs，终止时全部保留。',
 '没有从世界、补给箱或其他实体额外取得石材。'
],['stonecutter','window_slots','resource_planning'],'用普通工作台配方，六块石头只做出四个楼梯。');
add(57,2,'工作站与村民','铁砧修复和命名','把指定铁镐修好一些，并改名为“勘探镐”，最多使用2个铁锭。',{iron_pickaxe:1,iron_ingot:2},['anvil','pickaxe_damaged_50_percent','agent_xp_level_10'],[
 '同一铁镐最终自定义名字为勘探镐，损伤值小于初始值。',
 '最多消耗2铁锭；完成真实铁砧操作且没有复制或替换工具。'
],['anvil','window_slots','inspect_durability','xp_management'],'把名字改了就声称已修好，或忽略经验成本。');
add(58,3,'工作站与村民','新版锻造台三输入升级','用给定材料把钻石镐升级为下界合金镐。',{diamond_pickaxe:1,netherite_ingot:1,netherite_upgrade_smithing_template:1},['smithing_table'],[
 '真实锻造得到1把netherite_pickaxe。',
 '使用并消耗升级模板、钻石镐和下界合金锭，不能沿用不需要模板的旧版本流程。'
],['smithing','window_slots','recipe_versioning'],'按旧版两输入锻造流程操作。',['archaeology'],'1.20');
add(59,3,'工作站与村民','合成器自动做火把','配置合成器，用红石触发生产16支火把，不要用普通工作台代做。',{crafter:1,coal:4,stick:4,stone_button:1,stone:2},['clear_redstone_plot','output_collection_area'],[
 '配置槽位并用红石激活，累计至少4次有效合成器出料，产出16支torch。',
 'Agent收取16支火把；普通工作台产出不计入。'
],['crafter','slot_enable_disable','redstone','item_collection'],'没有禁用多余槽位，或只有摆出配方而没有红石触发。',['trials'],'1.21');
add(60,2,'工作站与村民','堆肥桶获取骨粉','利用堆肥桶和给定种子获取1个骨粉。',{composter:1,wheat_seeds:128},['clear_plot'],[
 '记录到合法堆肥填充、成熟和取出流程，最终取得至少1个bone_meal。',
 '没有把只填到未成熟阶段当作成功，额外骨粉不来自其他来源。'
],['composter','use_item','world_state'],'不知道要等成熟并再次交互领取；按固定次数点击就宣称成功。');

add(61,2,'弓弩盾牌与战斗','弓的蓄力和距离补偿','从固定射击线命中三个标靶，每个至少一次，最多使用12支箭。',{bow:1,arrow:12},['target_blocks_at_2_16_24_blocks','fixed_firing_line','dry_clear_range'],[
 '三处不同距离标靶各记录至少一次由Agent箭矢产生的命中。',
 '计分射击达到未附魔弓满蓄力状态；按服务器使用时长及弹射物状态预验，暂定20游戏刻。',
 '没有越过射击线缩短距离，使用箭矢不超过12支。'
],['bow_charge_release','aim_ballistics','projectile_tracking'],'点按不蓄力、远距离不抬高瞄准、用旧版固定宽容碰撞框代替实际命中。',['bow','release']);
add(62,3,'弓弩盾牌与战斗','移动目标预判','用弓命中沿固定路线运动的指定僵尸至少3次，只能远程攻击。',{bow:1,arrow:16},['marked_moving_zombie_with_health_40','deterministic_patrol','firing_zone'],[
 '同一指定僵尸受到至少3次Agent弓箭命中，箭矢身份和命中时间可追溯。',
 '没有使用近战伤害或追到靶场限制距离内，最多发射16支箭。'
],['aim_leading','bow_charge_release','projectile_tracking'],'只瞄准目标当前坐标，不考虑运动与飞行时间。',['bow']);
add(63,2,'弓弩盾牌与战斗','弩的预装与切换','先给弩装箭，切到其他物品至少2秒，再切回弩射中标靶。',{crossbow:1,arrow:3,stone_pickaxe:1},['target_block_16_blocks'],[
 '同一把弩在装填后存在charged_projectiles，切换物品至少40游戏刻后仍保留弹药。',
 '重新装备后发射并命中指定标靶，不能在切回后重新装填来替代预装。'
],['crossbow_load','hotbar_switch','inspect_components','aim_ballistics'],'把弩当弓，装填后松手就以为已经发射。',['crossbow']);
add(64,2,'弓弩盾牌与战斗','盾牌正面格挡','在标记位置用盾牌挡住骷髅射来的3支箭，不能靠躲到墙后完成。',{shield:1,iron_sword:1},['single_skeleton_controlled_lane','start_after_ready','no_cover_in_counting_zone'],[
 '至少3次真实盾牌格挡，攻击来源和Agent朝向匹配；仅装备在副手不计分。',
 '格挡阶段Agent损失生命值不超过4，不能通过无限拉远距离让骷髅停止射击。'
],['shield_raise_lower','offhand','face_threat','combat_telemetry'],'只有装备而没有举盾，或背对来箭方向。',['shield']);
add(65,3,'弓弩盾牌与战斗','双方向威胁与转盾','左右两个发射方向按固定信号轮流攻击，请转向并各成功格挡3次。',{shield:1},['two_skeleton_lanes_120_degrees_apart','fixed_public_attack_signal','no_simultaneous_unblockable_setup'],[
 '来自两条射线的攻击各有至少3次真实格挡，方向标签和伤害事件可验证。',
 '损失生命值不超过6，保持在标记防守区内。'
],['face_threat','shield_raise_lower','reactive_control'],'把盾牌当作全方向被动护甲。',['shield']);
add(66,2,'弓弩盾牌与战斗','近战攻击冷却','使用铁剑击败指定僵尸，尽量让每次有效攻击充分恢复后再出手。',{iron_sword:1,shield:1},['zombie_with_health_40','safe_melee_arena'],[
 '由Agent铁剑击杀指定僵尸。',
 '至少80%的有效近战攻击在攻击强度恢复到0.9以上时发起；同时报告空挥次数，不用客户端点击间隔替代实际强度。'
],['melee_cooldown','attack_timing','combat_telemetry'],'连续乱点导致每次伤害很低；把旧版点击频率当成战斗能力。');
add(67,3,'弓弩盾牌与战斗','跳劈暴击','对指定僵尸完成至少2次合法近战暴击，并击败它。',{iron_sword:1},['zombie_with_health_40','flat_arena','no_strength_or_jump_effects'],[
 '指定目标至少承受2次服务器确认的Agent近战暴击，而非仅跳跃动画或普通命中。',
 '最终由Agent击杀目标，期间没有攻击人类玩家。'
],['jump_fall_timing','melee_cooldown','combat_telemetry'],'上升阶段出手、疾跑条件不合或冷却不足却自称暴击。');
add(68,3,'弓弩盾牌与战斗','落地水与回收','从标记的12格高台落下，用水安全着陆，并把水重新收回桶中。',{water_bucket:1},['platform_12_blocks','clear_landing_zone','no_existing_water_or_soft_landing'],[
 '记录一次至少10格连续下落，并在落地区实际放出水。',
 '该次着陆没有摔落伤害，最后背包重新有1个water_bucket。'
],['fall_prediction','timed_item_use','bucket','world_state'],'在空中乱点、到地面才放水、或忘记收水。');
add(69,2,'弓弩盾牌与战斗','划船运输与回收','坐船把指定牛带到河对岸，安全下船，并回收船。',{oak_boat:1,wheat:8},['adult_cow','river_transport_route','far_bank_pen'],[
 '指定牛与Agent确实乘坐同一船并完成过河位移。',
 '牛存活且位于对岸目标区，Agent在岸上，船作为物品回收到背包。'
],['animal_luring','boat_mount_control','vehicle_dismount','entity_tracking'],'牛上船但自己没上；拆船时误伤乘客；只游泳到对岸。');
add(70,3,'弓弩盾牌与战斗','深水取物与呼吸管理','从水下长通道尽头取回标记物，再回到岸边，不能受到溺水伤害。',{oak_door:4,stone_pickaxe:1},['underwater_corridor_35_blocks','deep_water','underwater_chest_marked_item','valid_door_floor'],[
 '指定箱子中的1颗amethyst_shard由Agent带回岸边。',
 '无溺水伤害，服务器记录到有效补气或其他题面允许的呼吸管理；不能依靠管理员氧气恢复。'
],['swimming','air_management','door_air_pocket_java','chest'],'沿用基岩版水下门规则、忘记氧气或以血量硬换时间。');

add(71,3,'红石与环境机制','射击标靶开门','用弓触发标靶控制的铁门，并穿过门到达出口。',{bow:1,arrow:6},['target_block_redstone_iron_door','no_access_to_wiring','door_exit_marker'],[
 'Agent箭矢命中标靶后产生实际红石输出并令指定铁门打开。',
 'Agent在门打开期间通过门到达出口，没有拆门、挖墙或越界绕行。'
],['bow_charge_release','aim_ballistics','redstone_feedback','navigation'],'射中了却没有及时通行，或把标靶当成只计伤害的实体。',['bow']);
add(72,2,'红石与环境机制','漏斗方向与转运','用两个漏斗把源箱中的32个小麦转入目标箱，不要手动搬运小麦。',{hopper:2},['source_chest_32_wheat','destination_chest','two_hopper_gap'],[
 '目标箱最终有32个wheat，源箱为0。',
 '全部32次转移经指定漏斗网络，Agent不能直接从源箱取出小麦。'
],['hopper_orientation','place','container_network','verify'],'漏斗朝向错误或把能站在上面当作能自动转运。');
add(73,3,'红石与环境机制','红石火把反相','搭一个杠杆控制的反相灯：杠杆关时灯亮，杠杆开时灯灭。',{lever:1,redstone_torch:1,redstone_lamp:1,redstone:8,stone:8},['redstone_plot','input_and_output_markers'],[
 '按冻结的关→开→关输入序列，灯实际输出亮→灭→亮。',
 '自动检查期间不得由Agent手动破坏、放置或切换灯来冒充电路输出。'
],['redstone_logic','place','verify'],'只做同相开关，或口头解释对但实际电路不工作。');
add(74,2,'红石与环境机制','黏性活塞推拉','让黏性活塞把指定石块推出一格，再拉回原位。',{sticky_piston:1,lever:1,stone:3},['piston_origin_and_target_markers'],[
 '同一标记石块实际随活塞伸出移动一格，随后缩回原位。',
 '不是通过Agent挖掉并重新放置石块完成位置变化。'
],['piston_orientation','redstone','world_state'],'活塞朝反、以为普通活塞也会把方块拉回。');
add(75,4,'红石与环境机制','观察者甘蔗自动收获','建一个观察者触发的甘蔗收获装置，收获至少2根上部甘蔗并保留根部。',{observer:1,piston:1,redstone:8,hopper:1,chest:1,stone:16},['near_mature_sugar_cane','water_and_root_sugar_cane','growth_preflighted_snapshot'],[
 '甘蔗长高的方块更新触发观察者与活塞，至少2个甘蔗掉落物自动进入收纳箱。',
 '根部甘蔗及其生长条件保留，Agent没有直接手动挖甘蔗冒充自动收获。'
],['observer','redstone','automatic_farm','hopper_orientation','verify'],'在Java版用骨粉强行催甘蔗，或者割掉根部导致不可持续。');
add(76,2,'红石与环境机制','考古刷取而非挖掘','从指定可疑沙中刷出藏品并收取，不能直接挖掉方块。',{brush:1},['suspicious_sand_with_fixed_pottery_sherd','normal_sand_decoys'],[
 '通过真实刷取进度完成一次藏品释放并收取指定陶片。',
 '目标方块未被直接挖掘破坏，未用普通沙子或其他陶片替换。'
],['archaeology','held_item_duration','block_identification'],'拿镐挖掉可疑沙，或把刷子短点一次当成完成。',['archaeology'],'1.20');
add(77,3,'红石与环境机制','灵魂沙气泡电梯','建一个8格高的灵魂沙上升水电梯，并乘它到达顶部。',{soul_sand:1,kelp:16,water_bucket:1,glass:40},['elevator_frame_marker','renewable_water_pool','top_landing_platform'],[
 '目标水柱8格形成正确向上的气泡柱，底部为灵魂沙；不能只留下流动水。',
 'Agent实际通过气泡柱上升至少7格并到达顶部平台，没有梯子或传送替代。'
],['source_water','kelp','bucket','place','swimming'],'流动水不形成预期气泡柱，或误用岩浆块造成下拉。');
add(78,2,'红石与环境机制','皮革靴与粉雪','穿过标记的粉雪路，取回终点物品，不能沉入危险区。',{leather_boots:1},['powder_snow_path','goal_item','no_alternative_route'],[
 'Agent穿皮革靴沿粉雪表面越过指定区域，取回目标物。',
 '没有陷入粉雪下方危险区、冻伤或绕路，不能用普通铁靴替代。'
],['equipment_mechanics','navigation','world_state'],'认为越高级的护甲越适合所有地形。');
add(79,4,'红石与环境机制','幽匿振动与羊毛隔离','取回房间箱子里的标记物，但不要触发指定幽匿感测体。',{white_wool:16},['sculk_sensor_guarded_chest','wool_placeable_buffer','sensor_preflighted_sensitivity'],[
 '指定箱子目标物由Agent取出并带回入口。',
 '整个计分阶段没有Agent导致的感测体激活；不能破坏感测体或用管理员静音。'
],['sneaking','vibration_knowledge','wool_occlusion','place','chest'],'只潜行走路，却在开箱时产生未隔离振动。');
add(80,3,'红石与环境机制','下界重生锚','在下界设置一个可用重生点，不要引发爆炸。',{respawn_anchor:1,glowstone:2,white_bed:1},['nether_safe_room','valid_anchor_marker'],[
 '重生锚位于指定安全处，至少有1级充能，玩家重生维度及坐标确实绑定该锚。',
 '没有尝试在下界睡床或引爆其他错误维度的重生设备；不要求实际死亡验证。'
],['dimension_knowledge','respawn_anchor','use_item','inspect_player_state'],'在下界按主世界习惯放床并睡觉。');

add(81,3,'试炼与新战斗','普通试炼刷怪笼','激活并完成一次普通试炼刷怪笼挑战，收取它的奖励。',{iron_sword:1,shield:1,bow:1,arrow:32,cooked_beef:16},['normal_trial_spawner_fixed_mob_set','single_counted_player','safe_trial_arena'],[
 '指定普通试炼刷怪笼经历激活、挑战完成和奖励释放状态，进入完成后的冷却。',
 'Agent收取本次释放的奖励；不要求随机奖励一定包含试炼钥匙。'
],['trial_spawner','mob_combat','combat_resource_management','verify'],'以为插火把就完成试炼；把随机没出钥匙误判为任务失败。',['trials'],'1.21');
add(82,2,'试炼与新战斗','宝库与单人领取状态','用试炼钥匙打开指定宝库并收取奖励，保留没有消耗的其他钥匙。',{trial_key:2},['normal_vault_not_rewarded_for_agent','fixed_reward_fixture'],[
 '宝库对当前Agent发生一次有效解锁并释放奖励，Agent收取该次掉落。',
 '仅消耗1把钥匙，剩余1把仍在背包；不能把宝库当作普通箱子。'
],['vault','use_item','identity_tracking','item_collection'],'无视当前玩家已经领取过奖励的状态，反复尝试开同一宝库。',['trials'],'1.21');
add(83,4,'试炼与新战斗','不祥之瓶与不祥试炼','利用给定不祥之瓶开启并完成一次不祥试炼，收取奖励。',{ominous_bottle:1,diamond_sword:1,shield:1,bow:1,arrow:64,cooked_beef:24},['trial_spawner_ominous_eligible','no_nearby_village','single_counted_player'],[
 '有饮用不祥之瓶、获得相关效果并使指定刷怪笼进入不祥试炼状态的完整证据。',
 '挑战实际完成且奖励被收取；不以必须随机获得某种稀有奖励为判据。'
],['status_effects','ominous_trials','mob_combat','combat_resource_management'],'把普通与不祥试炼混为一谈，或在错误场景误触袭击。',['trials'],'1.21');
add(84,4,'试炼与新战斗','风弹起跳与重锤重击','借助风弹起跳，用重锤重击指定僵尸并安全落地。',{mace:1,wind_charge:8},['designated_zombie','flat_smash_arena'],[
 '同一连续动作链中由Agent风弹产生向上位移，随后下落重锤命中被服务器判为重击。',
 '指定目标受到重击伤害，Agent没有摔落死亡；普通地面挥锤不计分。'
],['wind_charge_movement','fall_prediction','mace_smash','timed_attack'],'只在地面挥重锤，或起跳后上升阶段就出手。',['trials'],'1.21');
add(85,3,'试炼与新战斗','旋风人的远程反制','击败指定旋风人并收取旋风棒，注意选择有效攻击方式。',{iron_sword:1,shield:1,bow:1,arrow:12,cooked_beef:8},['designated_breeze','bounded_breeze_arena'],[
 '指定breeze由Agent合法击杀，取得至少1个breeze_rod。',
 '成功造成伤害的攻击方式有记录；另外报告无效弓箭尝试数，不将弓箭命中反弹动画当作伤害。'
],['mob_specific_tactics','melee_cooldown','projectile_feedback'],'持续对会反制普通弹射物的旋风人射箭。',['trials'],'1.21');
add(86,3,'1.21.6天空与运输','干枯恶魂水合','把干枯恶魂恢复成小恶魂，并保证它存活。',{dried_ghast:1,water_bucket:1},['safe_hydration_plot','renewable_water_pool'],[
 '初始无水合进度的同一干枯恶魂持续获得合法水合条件，最终生成幼年快乐恶魂。',
 '幼体存活；不能挖掉重放冒充保留进度，也不能用预置实体替换。'
],['waterlogging','long_wait_monitoring','entity_lifecycle'],'反复挖掘重放导致水合进度重置。',['release','ghast_growth'],'1.21.6');
add(87,3,'1.21.6天空与运输','喂养小恶魂与制作挽具','用雪球照料指定小恶魂，长大后制作并给它装备白色挽具。',{snowball:64,leather:3,glass:2,white_wool:1},['juvenile_happy_ghast','crafting_table','safe_ghast_enclosure'],[
 '指定幼年happy_ghast有被雪球喂养的事件，最终成为存活成年个体。',
 'Agent真实制作white_harness并装备到该成年个体；不能使用鞍或凭空“繁殖”。'
],['entity_age','feed_snowballs','craft','harness_equip'],'把幼体当成单独ghastling实体ID，或以为快乐恶魂可以像牛一样繁殖。',['ghast','release'],'1.21.6');
add(88,3,'1.21.6天空与运输','快乐恶魂驾驶与安全离乘','装备挽具，驾驶指定快乐恶魂依次通过三个空中标记，再回到安全平台离乘。',{white_harness:1},['adult_happy_ghast','three_air_waypoints','safe_return_platform'],[
 'Agent位于可操控的驾驶位，按顺序通过三个三维航点；仅作为乘客不算。',
 '回到平台后安全离乘，无摔落死亡，快乐恶魂存活。'
],['harness_equip','mount_seat_selection','flight_control','safe_dismount'],'占了乘客位却持续发移动命令，或高空直接跳下。',['ghast'],'1.21.6');
add(89,3,'1.21.6天空与运输','生物之间的拴绳与剪断','把两头指定牛连成拴绳链，带到牛栏，再用剪刀解除拴绳。',{lead:3,shears:1,wheat:8},['two_designated_cows','transport_route','destination_pen'],[
 '至少一次真实建立牛与牛之间的拴绳关系，不能仅两头都分别拴在Agent身上。',
 '两头牛均存活并到达目标栏，最终使用剪刀解除相关连接并回收掉落拴绳。'
],['leash_graph','sneak_interact','animal_transport','shear_leash'],'把旧版只能拴玩家或栅栏的操作逻辑直接照搬。',['release'],'1.21.6');
add(90,2,'1.21.6天空与运输','可合成的鞍与剪下装备','制作鞍，给指定已驯服马装备，骑到标记处后下马，用剪刀取回鞍。',{leather:3,iron_ingot:1,shears:1},['tamed_unsaddled_horse','crafting_table','horse_route_marker'],[
 '本回合用新配方制作saddle，装备同一指定马并骑行到目标。',
 '下马后以剪刀取下鞍并收回背包，马存活且最终不带鞍。'
],['recipe_versioning','saddle_equip','horse_control','shear_equipment'],'以为鞍仍然不能合成；蹲着或有骑手时反复尝试剪下。',['saddle','release'],'1.21.6');

add(91,4,'稀有机制与综合游玩','快乐恶魂吊运载牛船','将指定牛装入船，用快乐恶魂吊运过峡谷，在对岸安全卸下牛和船。',{white_harness:1,oak_boat:1,lead:3,shears:1,wheat:8},['adult_happy_ghast','designated_cow','canyon_transport_route','unloading_platform'],[
 '载牛船与快乐恶魂存在真实运输连接，并共同越过峡谷检查平面。',
 '牛存活且到达目标区，完成安全卸载；没有让牛落入峡谷或用传送替代。'
],['boat_loading','leash_graph','flight_control','cargo_unloading'],'船还没连好就起飞、运输中断绳、或用错误离乘动作摔落。',['ghast'],'1.21.6');
add(92,4,'稀有机制与综合游玩','反弹恶魂火球取得Tears','反弹指定恶魂发出的火球将其击杀，并收取Tears唱片。',{iron_sword:1,shield:1,cooked_beef:8},['designated_hostile_ghast','safe_fireball_arena','no_other_loot_sources'],[
 '指定恶魂死于被Agent反弹的火球，弹射物来源和反弹所有者可追踪。',
 'Agent收取本次掉落的music_disc_tears；其他武器直接击杀不算。'
],['projectile_parry','timed_attack','provenance_tracking','item_collection'],'只用弓或剑击杀后期待获得特定唱片。',['release'],'1.21.6');
add(93,3,'稀有机制与综合游玩','猪灵以物易物','与指定普通成年猪灵完成3次以物易物，收取它给出的奖励，不要攻击它。',{gold_ingot:3,golden_helmet:1},['adult_piglin','piglin_brute_decoy_at_safe_distance','nether_barter_area'],[
 '3个金锭被正确交给成年普通猪灵，并完成3次实际以物易物。',
 '本次每次奖励都被收取，未攻击猪灵；不要求随机出现某一种奖励。'
],['mob_identification','barter','equip','reward_collection'],'给金粒、喂给猪灵蛮兵、或金币丢出就离开。',['release']);
add(94,3,'稀有机制与综合游玩','犰狳鳞甲与狼铠','刷取犰狳鳞甲，制作狼铠并给指定属于你的成年驯服狼穿上。',{brush:2},['armadillo','agent_owned_adult_tamed_wolf','crafting_table'],[
 '本回合从犰狳刷取至少6个armadillo_scute并真实制作wolf_armor。',
 '狼铠装备到指定己方狼，狼与犰狳均存活，不能通过杀犰狳获取材料。'
],['brush_entity','durability_budget','craft','pet_owner_check','animal_equipment'],'忘记刷子耐久、给非己方或幼年狼装备、攻击犰狳。',['wolf'],'1.20.5');
add(95,2,'稀有机制与综合游玩','收纳袋容量与取物','把四类各16个的材料装入一个收纳袋，木镐留在外面；再取出8支火把交付。',{bundle:1,oak_log:16,cobblestone:16,sand:16,torch:16,wooden_pickaxe:1},['delivery_chest'],[
 '曾有同一收纳袋同时装入16原木、16圆石、16沙、16火把，达到64个可64堆叠物品的容量。',
 '最终袋内保留前三类各16和8支火把，交付箱内有8支火把；木镐未被装入、丢弃或损坏。'
],['bundle_components','inventory_ui','capacity_reasoning','chest'],'认为收纳袋能放64组物品，或忽略不可堆叠工具的容量占用。',['bundle'],'1.21.2');
add(96,3,'稀有机制与综合游玩','雕刻南瓜与铁傀儡','用给定材料造出一只铁傀儡，不能攻击它。',{iron_ingot:36,pumpkin:1,shears:1},['crafting_table','valid_golem_build_plot'],[
 '真实制作4个iron_block，并使用剪刀把南瓜雕刻成carved_pumpkin。',
 '通过本回合合法结构搭建生成新的player-created铁傀儡，不能使用初始个体充数；傀儡存活。'
],['carve_pumpkin','structure_activation','placement_order','entity_tracking'],'南瓜没雕刻、头部放置顺序不对、或T形结构被周围方块挡住。');
add(97,2,'稀有机制与综合游玩','铜块涂蜡与刮除顺序','给A号氧化铜涂蜡；把B号涂蜡氧化铜恢复到未涂蜡的锈蚀铜。',{honeycomb:1,iron_axe:1},['A_oxidized_copper','B_waxed_oxidized_copper'],[
 'A最终为waxed_oxidized_copper。',
 'B最终为weathered_copper，并记录先去蜡再刮去一级氧化的两步真实斧头交互，不能挖掉重放。'
],['waxing','axe_scrape','block_state_transition'],'认为一次斧头交互同时去蜡和去氧化，或者刮过头。');
add(98,2,'稀有机制与综合游玩','识别咬钩的钓鱼','用鱼竿钓到至少3条鱼并保留，不要直接下水攻击鱼。',{fishing_rod:1},['valid_open_fishing_water','no_fish_item_cache'],[
 '至少3个属于cod、salmon、tropical_fish或pufferfish的物品来自本回合真实钓鱼收获。',
 '收竿时存在有效咬钩状态；没有直接击杀鱼、捡取预放鱼或只统计抛竿次数。'
],['fishing_bobber','bite_detection','timed_item_use','item_collection'],'固定时间乱收竿，不识别浮漂的实际状态。');
add(99,4,'稀有机制与综合游玩','防守反击与战备恢复','先格挡骷髅至少2箭，再用预装弩击败它；随后近战击败僵尸，回营地处理食物并恢复。',{shield:1,crossbow:1,arrow:12,iron_sword:1,beef:4,campfire:1},['designated_skeleton','designated_zombie','staged_combat_arena','camp_marker'],[
 '指定骷髅至少2次射击被盾牌真实格挡，随后死于Agent弩箭。',
 '指定僵尸死于Agent近战攻击，过程中没有攻击玩家。',
 '在营地用营火烤熟至少2份提供的牛肉，吃掉食物并最终生命值至少16、饥饿值至少18。'
],['shield_raise_lower','crossbow_load','melee_cooldown','campfire_cooking','healing_management'],'只会一套攻击循环，战后不会恢复或把营火当普通熔炉。');
add(100,5,'稀有机制与综合游玩','从零建立天空运输能力','从空背包开始取得干枯恶魂，回主世界培育、制作挽具，并驾驶快乐恶魂完成标记空中运输路线。',{},['survival_portal_resources','nether_fossil_with_dried_ghast','snow_and_water','cattle_and_sheep','safe_growth_plot','air_route_markers'],[
 '干枯恶魂来自本回合合法采集、合成或交易，而非初始赠予。',
 '水合、幼体成长、自制挽具装备形成可追溯完整链条；不得由管理员换成成年实体。',
 'Agent驾驶该成年快乐恶魂完成全部标记航点并安全返回。'
],['gather','craft','portal','waterlogging','long_wait_monitoring','feed_snowballs','harness_equip','flight_control','persistent_planning'],'拿到新物品就停工，等待期间丢失目标，或只完成培育却没有驾驶。',['ghast','release'],'1.21.6');

const task=id=>added.find(t=>t.id===`MC-${id}`);
task(57).initial_xp_level=10;
task(54).initial_item_components=[{item:'iron_pickaxe',enchantments:{unbreaking:1,vanishing_curse:1}}];
task(55).initial_item_components=[{item:'filled_map',map_scale:0,map_locked:false,map_region:'fixed_source_region'}];
task(57).initial_item_components=[{item:'iron_pickaxe',damage_fraction:0.5}];
task(61).grading_slices=['near-range versus far-range hit rate','draw-duration distribution','shots used'];
task(64).diagnostic_variants=[{name:'shield_temporarily_disabled',official_score:false,rule:'Only include after a Java 1.21.6 non-player axe/cooldown fixture is preflighted. Evaluate retreat/cover and recovery; do not add a human-player combat requirement.'}];
task(70).initial_environment={dimension:'overworld',water_corridor_length:35,door_air_pocket_rule:'Java 1.21.6 only; actual block collision and breathing verified before use'};
task(75).budget.wall_time_seconds=3600;
task(80).initial_environment={dimension:'the_nether'};
for(const id of [81,83,99])task(id).initial_inventory.iron_helmet=1;
task(83).initial_inventory.iron_chestplate=1;
task(86).expected_passive_wait_seconds=1200;
task(86).budget.wall_time_seconds=2700;
task(87).expected_passive_wait_seconds='growth may be accelerated through legal snowball feeding; log actual wait';
task(87).target_entity={type:'happy_ghast',juvenile:true};
task(88).target_entity={type:'happy_ghast',juvenile:false};
task(89).additional_constraint='Do not attack entities or intentionally snap leashes by teleporting. Crafting leads with the target-version five-string recipe is an optional paired variant, not required in the supplied-kit main task.';
task(94).fixture_note='Wolf Owner must be rebound to the actual episode Agent UUID during setup. Verify that two fresh brushes suffice for six brushing outputs on Java 1.21.6; otherwise adjust kit for all systems before freezing.';
task(99).scoring_order=['shield_blocks','crossbow_kill','melee_kill','campfire_cook_and_recover'];
task(100).budget={wall_time_seconds:7200,model_calls:450};
task(100).expected_passive_wait_seconds='hydration plus remaining juvenile growth; no time acceleration';
task(100).track='survival_chain_integration';

// Retain the original fifty objects exactly, including their IDs, kits, predicates and budgets.
const all=[...structuredClone(base.tasks),...added];
assert.equal(base.tasks.length,50);assert.equal(added.length,50);assert.equal(all.length,100);
assert.equal(new Set(all.map(t=>t.id)).size,100);
assert.deepEqual(all.slice(0,50),base.tasks);
for(let i=0;i<all.length;i++)assert.equal(Number(all[i].id.slice(3)),i+1);
for(const t of added){
 assert(t.success_all.length>=2&&t.capabilities.length>=2);
 for(const [name,count] of Object.entries(t.initial_inventory))assert(mc.itemsByName[name]&&count>0,`Invalid kit ${t.id}: ${name}`);
 for(const x of t.initial_item_components??[])for(const e of Object.keys(x.enchantments??{}))assert(mc.enchantmentsByName[e],`Unknown enchant ${e}`);
}
for(const item of ['saddle','lead','white_harness','dried_ghast','crafter','mace','wind_charge','wolf_armor','bundle','music_disc_tears','netherite_upgrade_smithing_template'])assert(mc.itemsByName[item],`Target version lacks ${item}`);
assert(mc.entitiesByName.happy_ghast);assert(!mc.entitiesByName.ghastling);
const newSaddle=mc.recipes[mc.itemsByName.saddle.id].find(r=>r.inShape);
const saddleIngredients=newSaddle.inShape.flat().filter(Boolean).map(id=>mc.items[id].name);
assert.equal(saddleIngredients.filter(x=>x==='leather').length,3);assert.equal(saddleIngredients.filter(x=>x==='iron_ingot').length,1);
const leadRecipe=mc.recipes[mc.itemsByName.lead.id].find(r=>r.inShape);
assert.equal(leadRecipe.inShape.flat().filter(Boolean).length,5);assert(leadRecipe.inShape.flat().filter(Boolean).every(id=>mc.items[id].name==='string'));

const protocol={...base.protocol,
 name:'MC-NPC-100',version:'0.2-design',status:'Design only. Original 50 preserved; 50 play-skill specifications added. No new world pack, grader, runner, training or in-game tests.',
 task_count:100,core_task_count:50,added_task_count:50,
 default_start_rule:'Original 50 unchanged. Added tasks explicitly declare kits, item components, XP and initial dimension; do not claim every new task starts empty.',
 grading:{...base.protocol.grading,primary:'Report original Core-50 SR and added Play-50 SR separately; optionally report equal-task MC-100 SR as a secondary aggregate.',fairness:'Supplied-kit mechanism tests and empty-inventory survival tests have separate breakdowns. No tool-gap exclusions from the denominator.'},
 evaluation:{...base.protocol.evaluation,main:'Three frozen instances per task, one rollout each: 300 episodes per Agent. Use staged pilots first; budgets remain uncalibrated.',difficulty:'Original 5x10 levels retained. Added level labels are independent estimates; total tasks per level need not equal 20.'},
 runtime_control:'Tactical timing and continuous physics use documented local skill controllers shared by compared planners; count controller calls and API calls separately.',
 anti_contamination:'Do not give held-out tasks reference solutions. A development checklist can guide skills, but cannot itself prove generalization.'
};

const out=new URL('./',import.meta.url);mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(new URL(name,out),value,'utf8');
save('tasks-100.json',JSON.stringify({protocol,tasks:all,references:sources},null,2)+'\n');
const categoryList=[...new Set(added.map(t=>t.category))];
let extra='# MC-NPC-100：新增50项游玩专项\n\n版本v0.2设计草案，2026-10-28。原MC-01—MC-50全部保留，本文件仅列MC-51—MC-100。均未进行游戏内可行性验证。\n\n';
for(const category of categoryList){
 extra+=`## ${category}\n\n`;
 for(const t of added.filter(t=>t.category===category)){
  extra+=`### ${t.id} ${t.title}（L${t.level}）\n\n**玩家指令**：${t.player_prompt}\n\n**输入**：${Object.keys(t.initial_inventory).length?Object.entries(t.initial_inventory).map(([name,n])=>`${name}×${n}`).join('、'):'空背包'}；经验等级${t.initial_xp_level}。${t.initial_item_components?'附加物品状态：'+JSON.stringify(t.initial_item_components)+'。':''}\n\n**场景**：${t.fixture_requirements.join('、')}。${t.initial_environment?'初始环境：'+JSON.stringify(t.initial_environment)+'。':''}\n\n**终态及过程判据**：\n\n`;
  for(const c of t.success_all)extra+=`- ${c.expectation_zh}\n`;
  extra+=`\n**能力**：${t.capabilities.join('、')}。\n\n**典型误区**：${t.common_failure}\n\n**暂定预算**：${Math.round(t.budget.wall_time_seconds/60)}分钟、${t.budget.model_calls}次模型调用。`;
  if(t.expected_passive_wait_seconds!==undefined)extra+=`自然等待另记：${t.expected_passive_wait_seconds}。`;
  if(t.fixture_note)extra+='\n\n**准备注意**：'+t.fixture_note;
  if(t.references.length)extra+='\n\n**机制参考**：'+t.references.map((url,i)=>`[官方资料${i+1}](${url})`).join('、')+'。';
  extra+='\n\n';
 }
}
save('新增50项游玩专项.md',extra);
let overview='# MC-NPC-100：完整100题总览\n\n原50题不删、不换ID、不改判据；新增50项机制与游玩任务。v0.2为设计清单，尚非可运行地图或判分程序。\n\n**阅读顺序**：先看本总览，再看《玩法评测与技能覆盖.md》，具体输入和判据见《新增50项游玩专项.md》及上级目录原50题清单。\n\n## 原50题：保持原样\n\n| ID | 难度 | 任务 |\n|---|---|---|\n';
for(const t of base.tasks)overview+=`| ${t.id} | L${t.level} | ${t.title} |\n`;
overview+='\n## 新增50题：实际游玩机制\n\n| ID | 类别 | 难度 | 任务 | 起始类型 |\n|---|---|---|---|---|\n';
for(const t of added)overview+=`| ${t.id} | ${t.category} | L${t.level} | ${t.title} | ${t.track==='mechanic_execution'?'提供装备，隔离机制':t.track==='survival_chain_integration'?'空背包全流程':'空背包'} |\n`;
overview+='\n## 版本边界\n\n目标始终是Java 1.21.6原版，包含此前已实装机制及1.21.6新增机制。物品存在检查不代表Mineflayer动作接口已经支持。没有为Agent新增技能、训练模型或执行任何一题。\n';
save('100题总览.md',overview);
save('capability-coverage.json',JSON.stringify({original_50_preserved:true,categories:categoryList.map(category=>({category,tasks:added.filter(t=>t.category===category).map(t=>t.id)})),skills:[...new Set(all.flatMap(t=>t.capabilities))].sort().map(skill=>({skill,tasks:all.filter(t=>t.capabilities.includes(skill)).map(t=>t.id),implementation_status:'not_audited'}))},null,2)+'\n');
for(const name of baselineFiles)assert.equal(sha(readFileSync(new URL('../'+name,import.meta.url))),baselineHashes[name],`Original artifact modified: ${name}`);
save('validation.json',JSON.stringify({status:'static_design_checks_passed',tasks:100,original_tasks_preserved:50,added_tasks:50,baseline_sha256:baselineHashes,checked:['100 unique continuous IDs','first 50 task objects deep-equal the original','all supplied item and enchantment IDs exist in Java 1.21.6 data','saddle recipe uses 3 leather and 1 iron ingot','lead recipe uses 5 strings','happy_ghast exists; ghastling is not a standalone entity ID','original six design files have unchanged hashes'],not_verified:['game-world feasibility','all mechanics on the actual target server','API and packet support for each skill','runtime event graders','timing/health/arrow thresholds','difficulty and budgets','training or actual Agent improvements']},null,2)+'\n');
console.log('Static checks passed: 100 tasks; original 50 retained exactly; 50 new play-skill tasks.');
