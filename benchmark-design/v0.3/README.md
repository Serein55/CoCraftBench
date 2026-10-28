# MC-NPC-100 v0.3：接口规范与benchmark映射

仅文档/数据规范，未实现或接入Agent。目标Java1.21.6，实际源码核对Mineflayer 4.33.0。

- [接口规范](Mineflayer接口规范.md)：分层、参数、生命周期、证据、禁攻击玩家、聊天隐藏命令与长程状态。
- [100题接口映射](100题接口映射.md)：保留全部题目，逐题列操作与工具缺口。
- [动作目录](action-catalog.json)：42个拟议操作及输入契约，全部spec_only。
- [能力映射](capability-interface-map.json)：140种原能力全部映射。
- [现有Mindcraft技能候选](mindcraft-bridge-candidates.json)：旧函数到新接口的对接位置及缺口。
- [逐题机器映射](task-interface-map.json)：100题及每条success_all绑定。
- [请求schema](action-request.schema.json)、[结果schema](action-result.schema.json)、[请求示例](request-examples.json)、[结果示例](result-example.json)。
- [源码核对](source-audit.json)、[静态检查](validation.json)。

原始100题仍在[上一版tasks-100.json](../v0.2/tasks-100.json)；蓝图与50题协议仍在上层目录。build-interfaces.mjs只是生成这些文档，不连接游戏、不调用模型、不实现任何控制器。当前Agent行为没有改变。
