import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const catalogPath = new URL('../benchmark-design/v0.3/action-catalog.json', here);
const outPath = new URL('../docs/action-map.md', here);

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const layerOrder = [
  'native_wrapper',
  'plugin_wrapper',
  'controller_required',
  'experimental_controller',
  'planner_service',
  'presentation_service',
  'orchestrator_service'
];

const layerDesc = {
  native_wrapper: '对已核对的 Mineflayer 原生调用做规范化封装',
  plugin_wrapper: '由已安装插件暴露的接口',
  controller_required: '有基础调用，需要局部状态机或闭环控制',
  experimental_controller: '特殊协议、GUI 或物理仍有缺口，未验证',
  planner_service: '规划器侧的持久化与阶段推进',
  presentation_service: '聊天表现层',
  orchestrator_service: '动作调度、查询与取消'
};

const groups = new Map(layerOrder.map((layer) => [layer, []]));
for (const action of catalog.actions) {
  if (!groups.has(action.layer)) groups.set(action.layer, []);
  groups.get(action.layer).push(action);
}

const counts = [...groups].map(([layer, list]) => `${layer} ${list.length} 个`);
const lines = [];

lines.push('# 动作映射表');
lines.push('');
lines.push('本文件由 `node tools/gen-action-map.mjs` 从 [action-catalog.json](../benchmark-design/v0.3/action-catalog.json) 生成，请勿手改。');
lines.push('');
lines.push(`共 ${catalog.actions.length} 个动作（${counts.join('、')}），实现状态均为 \`spec_only\`：契约已定义，代码尚未实现，也没有游戏内验证。`);
lines.push('');
lines.push('层次含义：');
lines.push('');
lines.push('| 层次 | 含义 |');
lines.push('|---|---|');
for (const layer of layerOrder) {
  if (groups.get(layer).length === 0) continue;
  lines.push(`| \`${layer}\` | ${layerDesc[layer]} |`);
}
lines.push('');
lines.push('“依赖调用”只表示该动作可以落到的 Mineflayer/插件接口面，不代表单次调用就能完成任务。');
lines.push('');

for (const layer of layerOrder) {
  const list = groups.get(layer);
  if (list.length === 0) continue;
  lines.push(`## ${layer}（${list.length}）`);
  lines.push('');
  lines.push('| 动作 | 中文名 | 实现状态 | 游戏内验证 | 依赖调用 |');
  lines.push('|---|---|---|---|---|');
  for (const action of list) {
    const calls = (action.native_calls_or_fields ?? [])
      .map((call) => `\`${call}\``)
      .join('<br>') || '—';
    lines.push(
      `| \`${action.name}\` | ${action.label_zh ?? ''} | ${action.implementation_status} | ${action.gameplay_validation} | ${calls} |`
    );
  }
  lines.push('');
  lines.push('契约要点：');
  lines.push('');
  for (const action of list) {
    lines.push(`- **\`${action.name}\`**：${action.contract_zh}`);
  }
  lines.push('');
}

lines.push('## 延伸阅读');
lines.push('');
lines.push('- 参数契约：[action-catalog.json](../benchmark-design/v0.3/action-catalog.json) 的 `arguments_schema`。');
lines.push('- 请求/返回外壳：[action-request.schema.json](../benchmark-design/v0.3/action-request.schema.json)、[action-result.schema.json](../benchmark-design/v0.3/action-result.schema.json)。');
lines.push('- 每题用到哪些动作：[task-interface-map.json](../benchmark-design/v0.3/task-interface-map.json) 与 [100题接口映射.md](../benchmark-design/v0.3/100题接口映射.md)。');
lines.push('- 能力到动作的对应：[capability-interface-map.json](../benchmark-design/v0.3/capability-interface-map.json)。');

writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`wrote ${outPath.pathname} (${catalog.actions.length} actions)`);
