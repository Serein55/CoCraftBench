import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mc = require('../mindcraft/node_modules/minecraft-data')('1.21.6');
const inv = items => ({ kind: 'inventory_at_least', items });
const craft = items => ({ kind: 'crafted_output_at_least', items });
const box = items => ({ kind: 'container_at_least', anchor: 'delivery_chest', items });
const event = (name, count, details = {}) => ({ kind: 'event_count', event: name, count, ...details });
const region = blueprint => ({ kind: 'blueprint_match', blueprint, anchor: blueprint.startsWith('house_') ? 'house_origin' : blueprint.startsWith('farm_') ? 'farm_origin' : blueprint.startsWith('wart_') ? 'wart_farm_origin' : blueprint.startsWith('bridge_') ? 'bridge_origin' : 'pen_origin', exact: true });
const equip = slots => ({ kind: 'equipped', slots });
const back = () => ({ kind: 'near_anchor', anchor: 'base', dimension: 'overworld', distance_max: 4 });
const ironArmor = { head: 'iron_helmet', torso: 'iron_chestplate', legs: 'iron_leggings', feet: 'iron_boots' };
const diamondArmor = { head: 'diamond_helmet', torso: 'diamond_chestplate', legs: 'diamond_leggings', feet: 'diamond_boots' };
const ironSet = Object.fromEntries(Object.values(ironArmor).map(item => [item, 1]));
const diamondSet = Object.fromEntries(Object.values(diamondArmor).map(item => [item, 1]));
const tasks = [];
function add(id, title, prompt, fixtures, criteria, skills, note = '') {
    const level = Math.ceil(id / 10);
    tasks.push({
        id: `MC-${String(id).padStart(2, '0')}`, level, title, player_prompt: prompt,
        initial_inventory: {}, initial_equipment: {}, initial_xp_level: 0,
        fixture_requirements: fixtures, success_all: criteria,
        capabilities: skills,
        budget: { wall_time_seconds: [600, 1200, 2100, 3600, 5400][level - 1], model_calls: [30, 60, 100, 160, 240][level - 1] },
        note
    });
}

add(1,'原木与木工具','采集至少10个橡木原木，并制作一把木斧和一把木镐。',['oak_forest'],[
    event('natural_log_collected',10,{ item: 'oak_log', source_region: 'harvest_zone' }), craft({wooden_axe:1,wooden_pickaxe:1}), inv({wooden_axe:1,wooden_pickaxe:1})
],['gather','craft'],'10个原木按本回合累计自然采集量计算；允许把它们消耗成工具，不要求最终剩余10个。');
add(2,'石镐与圆石','制作一把石镐，并在背包中保留至少16个圆石。',['oak_forest','stone_outcrop'],[craft({stone_pickaxe:1}),inv({stone_pickaxe:1,cobblestone:16})],['gather','craft']);
add(3,'工作台和箱子','制作工作台和箱子，并放到标记的两个位置。',['oak_forest','workstation_markers'],[craft({crafting_table:1,chest:1}),{kind:'blocks_at_markers',blocks:{crafting_table:'table_marker',chest:'chest_marker'}}],['gather','craft','place']);
add(4,'木炭生产','制作并放置熔炉，烧出至少8个木炭并保留在背包中。',['oak_forest','stone_outcrop','furnace_marker'],[craft({furnace:1}),event('smelt_output',8,{item:'charcoal'}),inv({charcoal:8}),{kind:'block_at_marker',item:'furnace',anchor:'furnace_marker'}],['gather','craft','smelt','place']);
add(5,'火把','制作并保留32支火把。',['oak_forest','stone_outcrop'],[craft({torch:32}),inv({torch:32})],['gather','craft','smelt']);
add(6,'石工具组合','制作一把石斧、一把石剑和一把石锹，保留这三件物品。',['oak_forest','stone_outcrop'],[craft({stone_axe:1,stone_sword:1,stone_shovel:1}),inv({stone_axe:1,stone_sword:1,stone_shovel:1})],['gather','craft']);
add(7,'玻璃','采集沙子并烧出8块玻璃，保留玻璃。',['oak_forest','stone_outcrop','sand_bank'],[event('smelt_output',8,{item:'glass'}),inv({glass:8})],['gather','craft','smelt']);
add(8,'白床','制作一张白色床并放在床位标记处。',['oak_forest','white_sheep','bed_marker'],[craft({white_bed:1}),{kind:'functional_bed_at_marker',item:'white_bed',anchor:'bed_marker'}],['gather','craft','place'],'本题允许击杀普通动物；与MC-15的禁止伤羊条件不同。');
add(9,'熟牛肉','获得并保留8块熟牛肉。',['oak_forest','stone_outcrop','cattle'],[inv({cooked_beef:8})],['gather','mob_combat','craft','smelt'],'允许熔炉烹饪或其他正常生存途径；地图没有现成熟食。');
add(10,'分类采集与交付','各采集16个泥土、沙子、圆石，存入标记的交付箱。',['oak_forest','stone_outcrop','sand_bank','dirt_bank','delivery_chest'],[box({dirt:16,sand:16,cobblestone:16})],['gather','craft','chest']);

add(11,'煤矿开采','采集并保留16个煤炭，不能用木炭替代。',['oak_forest','stone_outcrop','coal_ore'],[inv({coal:16})],['gather','craft','tool_selection']);
add(12,'铁锭','采掘铁矿并冶炼，获得16个铁锭。',['oak_forest','stone_outcrop','iron_ore','coal_ore'],[event('smelt_output',16,{item:'iron_ingot'}),inv({iron_ingot:16})],['gather','craft','smelt']);
add(13,'铁工具组合','制作铁镐、铁斧、铁锹各一把，并保留。',['oak_forest','stone_outcrop','iron_ore','coal_ore'],[craft({iron_pickaxe:1,iron_axe:1,iron_shovel:1}),inv({iron_pickaxe:1,iron_axe:1,iron_shovel:1})],['gather','craft','smelt']);
add(14,'剑盾装备','制作铁剑和盾牌，把铁剑拿在主手、盾牌放在副手。',['oak_forest','stone_outcrop','iron_ore','coal_ore'],[craft({iron_sword:1,shield:1}),equip({main_hand:'iron_sword',off_hand:'shield'})],['gather','craft','smelt','equip']);
add(15,'无伤剪羊毛','制作剪刀，获得8块白色羊毛，不能伤害或杀死羊。',['oak_forest','stone_outcrop','iron_ore','coal_ore','white_sheep'],[craft({shears:1}),event('sheared_wool_collected',8,{item:'white_wool'}),inv({white_wool:8}),{kind:'no_damage_to_species',species:'sheep'}],['gather','craft','smelt','use_item']);
add(16,'水桶与熔岩桶','制作两个桶，分别装水和熔岩，保留一桶水和一桶熔岩。',['oak_forest','stone_outcrop','iron_ore','coal_ore','water_pool','safe_lava_pool'],[craft({bucket:2}),inv({water_bucket:1,lava_bucket:1})],['gather','craft','smelt','use_item']);
add(17,'小型麦田','按地面标记建一个中心有水、周围8格耕地均种有小麦的3×3麦田。',['oak_forest','grass_and_seeds','water_pool','iron_ore','coal_ore','stone_outcrop','farm_3x3_marker'],[region('farm_3x3')],['gather','craft','smelt','farm','place'],'小麦处于任意生长阶段均可；不要求等待成熟。');
add(18,'面包','收获成熟小麦，制作并保留8个面包。',['mature_wheat_24'],[craft({bread:8}),inv({bread:8})],['farm','craft']);
add(19,'短途补给','准备16块熟牛肉、32支火把和一桶水，全部放入交付箱。',['oak_forest','stone_outcrop','coal_ore','iron_ore','cattle','water_pool','delivery_chest'],[box({cooked_beef:16,torch:32,water_bucket:1})],['gather','craft','smelt','chest','use_item']);
add(20,'铁轨与矿车','制作16个普通铁轨和一辆矿车，保留它们。',['oak_forest','stone_outcrop','coal_ore','iron_ore'],[craft({rail:16,minecart:1}),inv({rail:16,minecart:1})],['gather','craft','smelt']);

add(21,'全套铁甲','从零制作一整套铁甲并穿上：头盔、胸甲、护腿、靴子。',['oak_forest','stone_outcrop','coal_ore','iron_ore'],[craft(ironSet),equip(ironArmor)],['gather','craft','smelt','equip'],'铁甲四件的配方合计24个铁锭，不含采矿工具和燃料成本。');
add(22,'铁装战斗套装','制作并穿上全套铁甲，另外保留铁镐，并装备铁剑和盾牌。',['oak_forest','stone_outcrop','coal_ore','iron_ore'],[craft({...ironSet,iron_pickaxe:1,iron_sword:1,shield:1}),equip({...ironArmor,main_hand:'iron_sword',off_hand:'shield'}),inv({iron_pickaxe:1})],['gather','craft','smelt','equip']);
add(23,'首批钻石','采掘钻石矿，获得并保留3颗钻石。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore'],[event('mined_drop_collected',3,{item:'diamond',source_blocks:['diamond_ore','deepslate_diamond_ore']}),inv({diamond:3})],['gather','craft','smelt','tool_selection']);
add(24,'钻石镐与黑曜石','制作钻石镐，并用它采集4块黑曜石，保留钻石镐和黑曜石。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore','water_pool','safe_lava_pool'],[craft({diamond_pickaxe:1}),event('mined_drop_collected',4,{item:'obsidian',tool:'diamond_pickaxe'}),inv({diamond_pickaxe:1,obsidian:4})],['gather','craft','smelt','use_item','tool_selection']);
add(25,'时钟与指南针','制作并保留一个时钟和一个指南针。',['oak_forest','stone_outcrop','coal_ore','iron_ore','gold_ore','redstone_ore'],[craft({clock:1,compass:1}),inv({clock:1,compass:1})],['gather','craft','smelt','tool_selection']);
add(26,'蛋糕','制作一个蛋糕并放在蛋糕标记处，不要吃掉它。补给箱只提供一个鸡蛋。',['oak_forest','stone_outcrop','coal_ore','iron_ore','cattle','mature_wheat_3','sugar_cane','egg_cache_one','cake_marker'],[craft({cake:1}),{kind:'block_at_marker',item:'cake',anchor:'cake_marker',states:{bites:'0'}}],['gather','craft','smelt','farm','use_item','place'],'固定提供一个鸡蛋仅用于消除等鸡下蛋的随机等待；其他原料自行获取。');
add(27,'繁殖牛羊','分别繁殖一对成年牛和一对成年羊，得到一只小牛和一只小羊。',['adult_cow_pair','adult_sheep_pair','mature_wheat_8'],[event('breeding_birth',1,{species:'cow',caused_by:'agent'}),event('breeding_birth',1,{species:'sheep',caused_by:'agent'}),{kind:'offspring_alive',species:['cow','sheep']}],['farm','use_item','entity_tracking']);
add(28,'收获与复种','收获标记农田的24株成熟小麦，制作8个面包，并在原来的24格重新播种。',['mature_wheat_24','farm_24_marker','grass_and_seeds'],[event('crop_harvest',24,{item:'wheat',source_region:'farm_24'}),craft({bread:8}),inv({bread:8}),region('farm_24_replanted')],['farm','craft','place']);
add(29,'基础小木屋','在标记处建一座5×5橡木屋：三格内高、完整地板和屋顶、南侧一扇门、四扇单格玻璃窗。按提供的尺寸图施工。',['oak_forest','stone_outcrop','sand_bank','house_marker'],[region('house_5x5_empty')],['gather','craft','smelt','blueprint','place','verify']);
add(30,'可居住木屋','建造同样的5×5橡木屋，按家具位置图放好白床、工作台、熔炉和箱子，门到室内中央要能走通。',['oak_forest','stone_outcrop','sand_bank','white_sheep','house_marker'],[region('house_5x5_furnished'),{kind:'walkable_path',from:'outside_door',to:'house_center',clearance_height:2}],['gather','craft','smelt','blueprint','place','verify']);

add(31,'附魔台','从零制作一个附魔台，并放在标记处。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore','water_pool','safe_lava_pool','sugar_cane','cattle','enchant_marker'],[craft({enchanting_table:1}),{kind:'block_at_marker',item:'enchanting_table',anchor:'enchant_marker'}],['gather','craft','smelt','use_item','tool_selection','place']);
add(32,'钻石工具组合','制作钻石镐、钻石斧、钻石锹各一把，保留它们。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore'],[craft({diamond_pickaxe:1,diamond_axe:1,diamond_shovel:1}),inv({diamond_pickaxe:1,diamond_axe:1,diamond_shovel:1})],['gather','craft','smelt','tool_selection']);
add(33,'下界往返','自行建造并点燃下界传送门，进入下界，再返回主世界基地。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore','water_pool','safe_lava_pool','gravel','nether_safe_spawn'],[{kind:'agent_built_portal',activated:true},event('dimension_enter',1,{dimension:'the_nether'}),event('dimension_return',1,{from:'the_nether',to:'overworld'}),back()],['gather','craft','smelt','portal','navigation']);
add(34,'下界资源运输','进入下界，采集16个下界石英和16个荧石粉，返回基地并存入交付箱。',['portal_route_resources','nether_safe_spawn','nether_quartz_ore','accessible_glowstone','delivery_chest'],[event('dimension_enter',1,{dimension:'the_nether'}),box({quartz:16,glowstone_dust:16}),back()],['gather','craft','smelt','portal','navigation','chest']);
add(35,'抗火药水','从零酿造3瓶普通抗火药水并带回基地，不要改成喷溅药水。',['portal_route_resources','fortress_route','nether_wart','magma_cube_area','sand_bank','water_pool','base'],[{kind:'potion_inventory',item:'potion',potion:'fire_resistance',count:3},event('brewing_output',3,{potion:'fire_resistance'}),back()],['portal','mob_combat','brew','craft','smelt','navigation']);
add(36,'末影之眼','获得并保留4个末影之眼。',['portal_route_resources','fortress_route','enderman_encounters'],[craft({ender_eye:4}),inv({ender_eye:4})],['portal','mob_combat','craft','navigation']);
add(37,'可运行铁路','沿标记直线铺设16个普通铁轨和6个动力铁轨，正确供电，并乘矿车连续移动至少16格。',['oak_forest','stone_outcrop','coal_ore','iron_ore','gold_ore','redstone_ore','rail_corridor_22'],[{kind:'rail_corridor',length:22,ordinary_rails:16,powered_rails:6,powered:true},event('agent_minecart_ride',1,{continuous_distance_min:16})],['gather','craft','smelt','redstone','place','vehicle']);
add(38,'跨河木桥','沿标记建一座长12格、净通行宽2格的橡木桥，通道外两侧各有连续栏杆，并从桥上走到对岸。不能填平河道。',['oak_forest','river_gap_12','bridge_markers'],[region('bridge_12x2'),{kind:'water_region_unchanged',region:'river_below_bridge'},event('crossed_bridge',1,{on_bridge:true})],['gather','craft','blueprint','place','navigation','constraint']);
add(39,'农牧小基地','建24格带水小麦田，以及带栅栏门的牛栏，把两头指定成年牛完整带入并关好门。',['oak_forest','stone_outcrop','coal_ore','iron_ore','water_pool','grass_and_seeds','mature_wheat_8','adult_cow_pair','farm_and_pen_markers'],[region('farm_24_replanted'),region('cattle_pen'),{kind:'designated_entities_inside',species:'cow',count:2,region:'cattle_pen',alive:true},{kind:'gate_closed',anchor:'pen_gate'}],['gather','craft','farm','place','animal_luring','verify']);
add(40,'完整远征装备','制作并穿上全套铁甲，准备钻石镐、水桶、16个面包和64支火把；把四类补给存入基地交付箱。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore','water_pool','mature_wheat_48','delivery_chest'],[craft({...ironSet,diamond_pickaxe:1,bread:16,torch:64}),equip(ironArmor),box({diamond_pickaxe:1,water_bucket:1,bread:16,torch:64}),back()],['gather','craft','smelt','equip','farm','chest','planning']);

add(41,'全套钻石甲','从零制作并穿上全套钻石甲，不接受直接购买或拾取成品护甲。',['oak_forest','stone_outcrop','coal_ore','iron_ore','diamond_ore_large'],[craft(diamondSet),equip(diamondArmor)],['gather','craft','smelt','equip','planning']);
add(42,'烈焰棒远征','自行进入下界，获取6根烈焰棒，带回主世界基地。',['portal_route_resources','fortress_route','blaze_spawner','base'],[event('mob_drop_collected',6,{item:'blaze_rod',species:'blaze'}),inv({blaze_rod:6}),back()],['gather','portal','mob_combat','navigation','planning']);
add(43,'下界作物迁移','自行去下界取得下界疣和灵魂沙，在主世界基地的8个标记格铺灵魂沙并种满下界疣。',['portal_route_resources','fortress_route','nether_wart','soul_sand','wart_farm_marker'],[event('dimension_enter',1,{dimension:'the_nether'}),region('wart_farm_8'),back()],['gather','portal','navigation','farm','place','planning']);
add(44,'延长力量药水','从零酿造3瓶持续8分钟的力量药水，并放入交付箱。',['portal_route_resources','fortress_route','nether_wart','sand_bank','water_pool','redstone_ore','delivery_chest'],[{kind:'potion_container',anchor:'delivery_chest',item:'potion',potion:'long_strength',count:3},event('brewing_output',3,{potion:'long_strength'})],['gather','portal','mob_combat','brew','craft','chest','planning']);
add(45,'完整高级附魔流程','从零建造附魔台和15个有效书架，制作钻石镐，获得经验并对它完成一次30级档位附魔。',['enchanting_route_resources','lapis_ore','repeatable_xp_source','enchant_area'],[craft({enchanting_table:1,bookshelf:15,diamond_pickaxe:1}),{kind:'effective_bookshelves',anchor:'enchant_marker',count_min:15},event('enchanting_table_use',1,{option_required_level:30,item:'diamond_pickaxe'}),{kind:'enchanted_inventory_item',item:'diamond_pickaxe',any_non_curse:true}],['gather','craft','smelt','enchant','place','xp_management','planning'],'不指定抽中的附魔种类；避免把特定附魔的随机出现率当成规划能力。');
add(46,'交易与铁砧附魔','制作钻石镐，通过村民获得耐久III附魔书，制作铁砧并把附魔加到钻石镐上。',['oak_forest','stone_outcrop','coal_ore','iron_ore_large','diamond_ore','sugar_cane','cattle','fletcher_fixed','librarian_unbreaking_iii_fixed','repeatable_xp_source'],[craft({diamond_pickaxe:1,anvil:1}),event('villager_trade',1,{acquired_enchantment:'unbreaking',level:3}),event('anvil_apply_enchantment',1,{item:'diamond_pickaxe',enchantment:'unbreaking',level:3}),{kind:'enchanted_inventory_item',item:'diamond_pickaxe',enchantments:{unbreaking:3}}],['gather','craft','smelt','trade','anvil','xp_management','planning']);
add(47,'自给生存基地','建立完整木屋、24格小麦田、两头牛的封闭牛栏；穿上自制铁甲，并在屋内箱子储存16个面包和32支火把。',['house_farm_pen_resources','iron_ore','coal_ore','adult_cow_pair','base_markers'],[region('house_5x5_furnished'),region('farm_24_replanted'),region('cattle_pen'),{kind:'designated_entities_inside',species:'cow',count:2,region:'cattle_pen',alive:true},craft(ironSet),equip(ironArmor),{kind:'container_at_least',anchor:'house_chest',items:{bread:16,torch:32}}],['gather','craft','smelt','farm','animal_luring','blueprint','place','planning','verify']);
add(48,'中断后继续建房','收集材料建造带家具的5×5木屋。期间会发生一次机器人程序重启，请恢复后继续完成，不要重复领取任务或拆掉已完成部分。',['house_resources','house_marker','restart_hook'],[region('house_5x5_furnished'),event('benchmark_restart',1),{kind:'post_restart_progress',new_correct_cells_min:10},{kind:'protected_region_unchanged',region:'completed_floor_at_restart'}],['gather','craft','blueprint','place','persistent_memory','recovery','verify'],'仅主办方触发一次重启；世界和背包保留，内存对话清空，所有方案允许保留自己的本地任务文件。');
add(49,'施工中修改需求','先建一座5×5橡木屋，门朝南，按家具图放好白床、工作台、熔炉和箱子。收到后续修改时按新要求继续，保留已完成且符合新要求的结构。',['house_resources','stone_outcrop','house_marker','change_request_hook'],[region('house_5x5_revised'),event('benchmark_change_request',1),{kind:'protected_region_unchanged',region:'completed_floor_at_change'}],['gather','craft','blueprint','place','dialogue','replanning','constraint','verify'],'固定后续消息：屋顶改用圆石，保留其余结构和家具。');
add(50,'草方块：完整生存路线','从空背包开始，获得1个可以放进背包的草方块。不得使用管理员赠予、现成附魔工具或携带草方块的末影人路线。',['oak_forest_large','stone_outcrop','coal_ore','iron_ore_large','sugar_cane','cattle','grass_patch','fletcher_fixed','librarian_silk_touch_fixed','repeatable_xp_source'],[inv({grass_block:1}),event('silk_touch_block_drop_collected',1,{source_block:'grass_block',item:'grass_block',tool_enchantment:'silk_touch',source_region:'grass_patch'})],['gather','craft','smelt','trade','anvil','enchant','xp_management','tool_selection','planning'],'主路线固定可用的村民交易，不要求反复刷村民职业或等待附魔随机出现。普通挖掘得到泥土不算成功，种子、草和地表变绿也不算。');

tasks[47].intervention = { trigger: '25 floor cells and at least 5 correct wall cells placed', action: 'restart_agent_once', preserve: ['world','inventory','agent_persistent_files'], clear: ['process_memory','in_memory_chat'], downtime_seconds: 10 };
tasks[48].intervention = { trigger: '25 floor cells and at least 5 correct wall cells placed', action: 'send_user_message_once', message: '屋顶改用圆石，保留其余结构和家具。', final_blueprint: 'house_5x5_revised' };
tasks[49].diagnostic_variants = [
    { id: 'silk_tool_supplied', official_score: false, change: 'Provide a fresh iron_shovel with Silk Touch I; keep the grass patch.', purpose: 'Separate correct block harvesting from progression and resource planning.' },
    { id: 'silk_book_supplied', official_score: false, change: 'Provide Silk Touch I book only; no tool, anvil, iron, emeralds or XP.', purpose: 'Separate trading from anvil, XP and tool selection.' }
];
tasks[49].progress_milestones = [
    { weight:0.15, predicate:{kind:'ever_owned_tool_tier',tier_min:'stone'} },
    { weight:0.20, predicate:{kind:'ever_owned_silk_touch_source',allow:['enchanted_book','enchanted_tool']} },
    { weight:0.25, predicate:{kind:'ever_owned_usable_silk_touch_tool'} },
    { weight:0.20, predicate:event('silk_touch_block_drop_collected',1,{source_block:'grass_block',item:'grass_block'}) },
    { weight:0.20, predicate:inv({grass_block:1}) }
];

// Exact relative blueprint. The map author translates build_origin to a clear test plot.
const house = new Map();
const set = (x,y,z,item,states) => house.set(`${x},${y},${z}`,{x,y,z,item,...(states?{states}:{})});
for(let x=0;x<5;x++)for(let z=0;z<5;z++){
    set(x,0,z,'oak_planks'); set(x,4,z,'oak_planks');
    for(let y=1;y<=3;y++)set(x,y,z,(x===0||x===4||z===0||z===4)?'oak_planks':'air');
}
const door = (x,z,facing) => { set(x,1,z,'oak_door',{half:'lower',facing,open:'false'});set(x,2,z,'oak_door',{half:'upper',facing,open:'false'}); };
door(2,4,'north');
for(const [x,z] of [[0,2],[4,2],[2,0],[1,4]])set(x,2,z,'glass');
const emptyHouse=structuredClone([...house.values()]);
set(1,1,1,'white_bed',{part:'foot',facing:'south'});set(1,1,2,'white_bed',{part:'head',facing:'south'});
set(3,1,1,'crafting_table');set(3,1,2,'furnace');set(3,1,3,'chest');
const furnishedHouse=structuredClone([...house.values()]);
for(let x=0;x<5;x++)for(let z=0;z<5;z++)set(x,4,z,'cobblestone');
const revisedHouse=structuredClone([...house.values()]);
const farm=[];
for(let x=0;x<3;x++)for(let z=0;z<3;z++){
    farm.push({x,y:0,z,item:x===1&&z===1?'water':'farmland'});
    farm.push({x,y:1,z,item:x===1&&z===1?'air':'wheat',states:x===1&&z===1?{}:{age:{min:0,max:7}}});
}
const farm24=[];
for(let x=0;x<5;x++)for(let z=0;z<5;z++){
    farm24.push({x,y:0,z,item:x===2&&z===2?'water':'farmland'});
    farm24.push({x,y:1,z,item:x===2&&z===2?'air':'wheat',states:x===2&&z===2?{}:{age:{min:0,max:7}}});
}
const bridge=[];
for(let x=0;x<12;x++){
    for(let z=1;z<=2;z++){bridge.push({x,y:0,z,item:'oak_planks'});for(let y=1;y<=2;y++)bridge.push({x,y,z,item:'air'});}
    for(const z of [0,3]){bridge.push({x,y:0,z,item:'oak_planks'});bridge.push({x,y:1,z,item:'oak_fence'});}
}
const pen=[];
for(let x=0;x<5;x++)for(let z=0;z<5;z++)if(x===0||x===4||z===0||z===4){
    pen.push({x,y:1,z,item:x===2&&z===4?'oak_fence_gate':'oak_fence',...(x===2&&z===4?{states:{open:'false'}}:{})});
}
const wartFarm=[];
for(let x=0;x<4;x++)for(let z=0;z<2;z++){wartFarm.push({x,y:0,z,item:'soul_sand'});wartFarm.push({x,y:1,z,item:'nether_wart',states:{age:{min:0,max:3}}});}
const blueprints = {
    coordinate_system: 'Relative to task-specific anchors; x east, y up, z south. Different structures have distinct non-overlapping anchors.',
    state_matching: 'Only listed state keys are required. Age ranges accept any value in range. Unlisted states are ignored. Air cells are required empty.',
    house_5x5_empty: emptyHouse, house_5x5_furnished: furnishedHouse, house_5x5_revised: revisedHouse,
    farm_3x3: farm, farm_24_replanted: farm24, bridge_12x2:bridge, cattle_pen:pen, wart_farm_8:wartFarm,
    extra_constraints: ['Door must be operable with a clear external entry.', 'Furnished house must have a two-block-high walkable route from south entry to center.', 'Pen has four-block interior headroom and a full floor; marked terrain supplies its floor.', 'Do not change blocks outside authorized build/harvest regions.']
};
const protocol = {
    version:'0.1-design', status:'Design only; no world pack, grader, task runner or empirical difficulty calibration is included.',
    game:{edition:'Java',version:'1.21.6',mode:'survival',difficulty:'normal',experiments:false},
    independent_episodes:true, default_start:{inventory:{},equipment:{},xp_level:0,health:20,food:20,time_of_day:6000},
    death_ends_episode:true, allow_agent_cheats:false, allow_human_intervention:false,
    invariants:['No attacks or damage to human players.','No modifications of protected player structures.','All target resources must be obtained within the episode through permitted survival actions.'],
    npc_quality_requirements:['No raw executable commands in player-facing chat; report this quality metric separately from gameplay task success.'],
    grading:{primary:'macro average strict success across 50 tasks',success:'all task predicates plus no actual gameplay constraint violation',failure_denominator:'Tool gaps and model failures remain failures; invalid map snapshots or confirmed service outages invalidate the episode and require a logged rerun.',partial:'MC-50 uses its explicit weighted milestones; other tasks use equal-weight terminal predicate progress, with per-item count ratios capped at 1. Partial score is diagnostic and cannot replace strict success.'},
    evaluation:{pilot:'one independently reset episode per task',main:'three frozen world instances per task, one rollout each; 150 episodes per agent',same_budget_across_agents:true,tiers:'Difficulty groups are provisional. Do not claim strict ordering of every task before human pilots.'},
    knowledge_access:'Agent may read normal provided tool docs; no unrestricted Internet, evaluator world state, hidden item caches or access to other tasks. If Wiki access is enabled, publish a separate assisted track.',
    seeds:{status:'Unselected: must select, preflight, hash and freeze world snapshots before collecting results.',instances:['A','B','C']},
    source_notes:['Item IDs and key crafting recipes checked against installed minecraft-data for Java 1.21.6.','Game rules concerning drops, enchantments, villagers and interactions still require world-level preflight.','JSON predicates are a proposed specification DSL, not native Mindcraft task JSON.']
};

assert.equal(tasks.length,50);
assert.equal(new Set(tasks.map(t=>t.id)).size,50);
for(let level=1;level<=5;level++)assert.equal(tasks.filter(t=>t.level===level).length,10);
const registeredKinds=new Set();
function checkCriterion(c){
    registeredKinds.add(c.kind);
    for(const field of ['items','slots'])for(const item of Object.keys(c[field]??{})){
        const name=field==='slots'?c[field][item]:item;
        assert(mc.itemsByName[name],`Unknown item ${name}`);
    }
    if(c.item)assert(mc.itemsByName[c.item]||mc.blocksByName[c.item],`Unknown item ${c.item}`);
    if(c.blueprint)assert(blueprints[c.blueprint],`Unknown blueprint ${c.blueprint}`);
}
for(const task of tasks){for(const c of task.success_all)checkCriterion(c);for(const m of task.progress_milestones??[])checkCriterion(m.predicate);}
for(const cells of Object.values(blueprints).filter(Array.isArray))for(const cell of cells)if(cell.item)assert(mc.blocksByName[cell.item],`Unknown block ${cell.item}`);
for(const cells of Object.values(blueprints).filter(v=>Array.isArray(v)&&v.every(c=>typeof c==='object'&&'x' in c)))assert.equal(new Set(cells.map(c=>`${c.x},${c.y},${c.z}`)).size,cells.length,'Duplicate blueprint cells');
assert.equal(emptyHouse.filter(c=>c.item==='oak_planks').length,92);
assert.equal(emptyHouse.filter(c=>c.item==='glass').length,4);
assert.equal(revisedHouse.filter(c=>c.item==='cobblestone').length,25);
assert.equal(revisedHouse.filter(c=>c.item==='glass').length,4);
const ironCost=Object.keys(ironSet).reduce((sum,name)=>sum+mc.recipes[mc.itemsByName[name].id][0].inShape.flat().filter(Boolean).length,0);
assert.equal(ironCost,24);
assert.equal(tasks[49].progress_milestones.reduce((s,m)=>s+m.weight,0),1);

mkdirSync(new URL('./',import.meta.url),{recursive:true});
const save=(name,body)=>writeFileSync(new URL(name,import.meta.url),body,'utf8');
save('tasks-50.json',JSON.stringify({protocol,tasks},null,2)+'\n');
save('blueprints.json',JSON.stringify(blueprints,null,2)+'\n');
const names=['简单：基础生存','较简单：短链生产','中等：铁装与小型建造','困难：跨系统长链','很难：长程闭环与恢复'];
const itemNames = { oak_log:'橡木原木',wooden_axe:'木斧',wooden_pickaxe:'木镐',stone_pickaxe:'石镐',cobblestone:'圆石',crafting_table:'工作台',chest:'箱子',furnace:'熔炉',charcoal:'木炭',torch:'火把',stone_axe:'石斧',stone_sword:'石剑',stone_shovel:'石锹',glass:'玻璃',white_bed:'白床',cooked_beef:'熟牛肉',dirt:'泥土',sand:'沙子',coal:'煤炭',iron_ingot:'铁锭',iron_pickaxe:'铁镐',iron_axe:'铁斧',iron_shovel:'铁锹',iron_sword:'铁剑',shield:'盾牌',shears:'剪刀',bucket:'空桶',water_bucket:'水桶',lava_bucket:'熔岩桶',bread:'面包',rail:'普通铁轨',minecart:'矿车',iron_helmet:'铁头盔',iron_chestplate:'铁胸甲',iron_leggings:'铁护腿',iron_boots:'铁靴子',diamond:'钻石',diamond_pickaxe:'钻石镐',obsidian:'黑曜石',clock:'时钟',compass:'指南针',cake:'蛋糕',enchanting_table:'附魔台',diamond_axe:'钻石斧',diamond_shovel:'钻石锹',quartz:'下界石英',glowstone_dust:'荧石粉',ender_eye:'末影之眼',diamond_helmet:'钻石头盔',diamond_chestplate:'钻石胸甲',diamond_leggings:'钻石护腿',diamond_boots:'钻石靴子',blaze_rod:'烈焰棒',bookshelf:'书架',anvil:'铁砧',grass_block:'草方块' };
const listItems = items => Object.entries(items).map(([name,count])=>`${count}个${itemNames[name]??name}`).join('、');
const blueprintNames = {house_5x5_empty:'基础5×5木屋',house_5x5_furnished:'带家具5×5木屋',house_5x5_revised:'圆石屋顶且保留其余结构和家具的修订木屋',farm_3x3:'8格小麦田',farm_24_replanted:'24格已播种小麦田',bridge_12x2:'12格长、净通行宽2格的木桥',cattle_pen:'带门牛栏',wart_farm_8:'8格下界疣田'};
function describeCriterion(c){
    switch(c.kind){
        case 'inventory_at_least':return `最终背包至少有${listItems(c.items)}。`;
        case 'crafted_output_at_least':return `本回合真实制作产出累计至少${listItems(c.items)}。`;
        case 'container_at_least':return `指定箱子中至少有${listItems(c.items)}。`;
        case 'equipped':return `装备槽正确穿戴/持有：${Object.entries(c.slots).map(([slot,name])=>`${slot}=${itemNames[name]??name}`).join('、')}。`;
        case 'blueprint_match':return `${blueprintNames[c.blueprint]??c.blueprint}与公开蓝图匹配，要求的空气格也要保持空置。`;
        case 'blocks_at_markers':return '工作台和箱子分别位于各自指定标记。';
        case 'block_at_marker':return `${itemNames[c.item]??c.item}位于指定标记${c.states?.bites==='0'?'且未被食用':''}。`;
        case 'functional_bed_at_marker':return '指定床位有完整且可用的白床，床头床尾均正确。';
        case 'no_damage_to_species':return '整个回合没有对羊造成伤害。';
        case 'offspring_alive':return '本回合繁殖的小牛和小羊在终止时仍存活。';
        case 'walkable_path':return '门外到室内中央有至少两格高的可通行路径。';
        case 'agent_built_portal':return 'Agent在本回合建造并激活了有效下界传送门。';
        case 'near_anchor':return '最终回到主世界基地4格范围内。';
        case 'potion_inventory':return '最终保留3瓶普通抗火药水。';
        case 'potion_container':return '指定箱子中有3瓶8分钟力量药水，按实际药水数据判定。';
        case 'rail_corridor':return '标记的22格轨道完整，含16个普通铁轨及6个已供电动力铁轨。';
        case 'water_region_unchanged':return '桥下要求保留的水域没有被填平或改掉。';
        case 'designated_entities_inside':return '两头指定成年牛存活且位于封闭牛栏内。';
        case 'gate_closed':return '牛栏门关闭。';
        case 'effective_bookshelves':return '附魔台至少有15个有效书架，间隙和摆位合法。';
        case 'enchanted_inventory_item':return c.enchantments?'最终钻石镐带有耐久III附魔。':'最终保留带非诅咒附魔的钻石镐。';
        case 'post_restart_progress':return '程序重启后新完成至少10格正确施工。';
        case 'protected_region_unchanged':return '指定保护区或干预时已完成的地板保持不变。';
        case 'event_count':{
            const descriptions={natural_log_collected:`本回合从可采自然树区累计收取至少${c.count}个橡木原木，不能用箱子存货替代`,smelt_output:`本回合实际冶炼产出至少${listItems({[c.item]:c.count})}`,sheared_wool_collected:'通过剪羊毛收取至少8块白色羊毛',breeding_birth:`本回合由Agent繁殖产生至少${c.count}只${c.species==='cow'?'小牛':'小羊'}`,crop_harvest:'收获指定24株成熟小麦',mined_drop_collected:`由指定方块开采收取至少${listItems({[c.item]:c.count})}${c.tool?'，且使用钻石镐':''}`,dimension_enter:'本回合实际进入下界',dimension_return:'本回合实际从下界返回主世界',brewing_output:`本回合实际酿造产出至少${c.count}瓶指定药水`,agent_minecart_ride:'Agent实际乘矿车连续移动至少16格',crossed_bridge:'Agent沿建好的桥实际走到对岸',mob_drop_collected:'收取本回合烈焰人掉落的至少6根烈焰棒',enchanting_table_use:'实际选择30级档位给钻石镐附魔，不以口头声明或事后装备推断',villager_trade:'实际从指定村民交易取得耐久III附魔书',anvil_apply_enchantment:'实际使用铁砧把耐久III加到钻石镐上',benchmark_restart:'评测端的固定重启实际触发一次',benchmark_change_request:'固定后续修改消息实际触发一次',silk_touch_block_drop_collected:'实际使用带精准采集的合法工具打掉草方块并收取完整草方块掉落物'};
            return (descriptions[c.event]??`记录到指定机制事件${c.count}次`)+'。';
        }
        default:throw new Error('Missing human description: '+c.kind);
    }
}
let catalog='# MC-NPC-50：任务清单\n\n版本：0.1 设计草案，2026-10-28。五档各10题；尚未构建世界、执行任务或标定难度。每题独立重置，默认空背包、零经验、生存模式。规则和评分见《评测协议.md》。\n\n';
for(let level=1;level<=5;level++){
    catalog+=`## L${level} ${names[level-1]}\n\n建议初始上限：${[10,20,35,60,90][level-1]}分钟，${[30,60,100,160,240][level-1]}次模型调用。上限需要用人工试跑校准。\n\n`;
    for(const task of tasks.filter(t=>t.level===level)){
        catalog+=`### ${task.id} ${task.title}\n\n**玩家指令**：${task.player_prompt}\n\n**地图前提**：${task.fixture_requirements.join('、')}。\n\n**成功判据**：\n\n`;
        for(const c of task.success_all)catalog+=`- ${describeCriterion(c)}\n`;
        catalog+=`\n**主要能力**：${task.capabilities.join('、')}。\n`;
        if(task.note)catalog+=`\n**口径说明**：${task.note}\n`;
        catalog+='\n';
    }
}
catalog+='## 使用边界\n\n`tasks-50.json` 是完整50题的设计数据；其中谓词需要后续实现服务器侧判分。它不是直接可运行的 Mindcraft tasks/basic 配置。`blueprints.json` 给出建筑、农田、桥梁和牛栏的相对方块规范；地图作者还必须设置锚点、地形、实体、资源和保护区。\n';
save('任务清单.md',catalog);
save('validation.json',JSON.stringify({status:'static_design_checks_passed',tasks:tasks.length,levels:[1,2,3,4,5].map(level=>({level,count:tasks.filter(t=>t.level===level).length})),game_data_version:'1.21.6',checked:['unique task IDs','50 tasks, 10 per tier','declared item/block IDs','blueprint references','iron armor recipe totals 24 ingots','wooden house has 92 planks and 4 glass blocks','grass milestone weights sum to 1'],not_checked:['world feasibility','loot and breeding event instrumentation','exact interaction API coverage','time and call budget calibration','world-level success graders'],predicate_kinds:[...registeredKinds].sort()},null,2)+'\n');
console.log('Design checks passed: 50 tasks, 10 per tier; JSON, item IDs and blueprint references valid.');
