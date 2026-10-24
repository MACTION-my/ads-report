# Event Performance Hub 实施记录

最新业务口径以 2026-10-24 用户说明及 README 为准：PTA 为答应出席人数，Lead→PTA 使用 PTA / 广告 New Lead；成员可手填本人佣金，最终由 Admin 确认。以下为实施阶段历史计划。

## 用户澄清：团队直接填报为主

2026-10-23 用户确认每次活动结束后由负责 telesales 登录填写数据，不依赖外部系统采集。已新增服务端本人单行提交，分配人员只可改自己且不可改佣金；全场绩效仍全团队可看。缺报人员列表和催交覆盖未填人员，PIC 保留汇总/补录及整场提交权限。CSV/外部同步降为辅助渠道，Google 授权不再是该工作流前提；公司正式身份接入、后端部署与定时任务仍待配置。

## Phase 0 检查结果

完整读取 Downloads/EVENT_PERFORMANCE_HUB_CODEX_BRIEF.md。它是用户指定的实施规格，不是额外的生产服务授权。

现有仓库：无前端框架、package.json、数据库、正式账号体系或测试框架。daily_ads_dashboard.html 是单文件模板；scripts/build_report.py 注入广告 JSON；GitHub Actions 生成 index.html 并上传 GitHub Pages。另有广告用 Google Apps Script / Sheets 接口。浏览器门禁不是服务端鉴权。Apps Script 中存在硬编码共享密钥及公开读取逻辑，不可沿用作为新模块鉴权；不在这里复制密钥，不修改其生产数据。

Excel 检查：四张工作表 Sales Comm Scheme、TS Comm Scheme、Conversion、Zoom Attendance List。Conversion 第六行是表头，没有 newLeadPta；原表 PTA to Won 列有使用 Attended 作分母的公式，不能作为系统公式来源。Zoom Attendance List 前部含报告元信息，不能直接当标准 CSV。第一阶段使用明确标准模板；历史文件转换需预览确认。佣金不从示例公式猜测。

最初 Git 创建分支被工作区 .git 只读权限拒绝。用户要求接入 GitHub 后，通过获准的 Git 操作建立 codex/event-performance-hub 分支。新增内容隔离于 event-hub，不覆盖原广告系统；原有未跟踪 scripts/probe2.py、scripts/probe_jacky.py 不动。

## 目标工作流程

一个中心管理所有场次，不再每场复制文件。Admin 建场次并选 PIC、截止日期；PIC 填原始数字，预览警告，保存草稿、提交；后台保留不可变提交快照；Admin 退回附理由或确认最终版。缺 newLeadPta 保留 null。佣金及奖励须 Admin 确认。全团队看汇总，客户明细仅 Admin/该活动 PIC。名单导入与绩效归属分开，不用姓名猜配、也不把注册人数当出席人数。

## 架构与部署边界

新增 Node.js 22.13+（node:sqlite）后端与同站 /report 页面、/report/api API。SQLite 放在持久化磁盘、站点目录之外，备份包含 WAL 一致性；不适用于多实例写入。原静态广告报告继续原发布流程。GitHub Pages 不能运行此 API；需要公司反向代理 /report/* 到后端，同时继续转发 / 到现有静态站点。

不新增密码登录。受信身份网关须在验证公司身份后剥除用户传来的 X-Hub-* 头，注入 X-Hub-User 及高熵 X-Hub-Secret。后端仅监听 localhost；密钥环境变量 EVENT_HUB_PROXY_SECRET 至少 32 字符；角色来自服务端 users 表，不信任头内角色。必须由公司网关部署验证后才可开放，不可直接从浏览器传共享密钥。未配置时 API 返回 503。不能声称已接入公司 SSO。

## 数据库

users(id,displayName,role,active)；events(id,data JSON,revision)；stats(eventId,userId,data JSON)，复合主键；submissions(eventId,version,snapshot,actor,createdAt)，唯一版本；auditLogs(actor,action,entityId,data,createdAt)；importJobs(actor,eventId,rowCount,outcome,createdAt)；commissionRules（预留，未启用自动核算）；reminderLogs（预留，唯一 event/recipient/type/window）。外键开启。金额字段以整数分保存，API 输入输出 RM。客户名单后续用独立受限表，不混入全团队报表 JSON。

第一阶段行级权限由服务层统一执行；事件 revision 防止覆盖同事数据；写操作事务提交。只有 Admin 编辑活动/核准佣金/退回/最终确认；PIC 编辑负责活动的草稿；Viewer/Telesales 在第一阶段只读（逐人编辑流程暂不开）。提交、最终状态锁定普通编辑，退回必须理由。历史快照不随新数据变化。

## 开发顺序及验收

1. 核算、SQL、服务层、版本及权限测试。
2. 同站页面、活动管理、填报、CSV 预览/合并或替换、最终报告打印和月度 CSV。测试、语法检查、TypeScript 检查、构建。
3. 受限出席名单、导入映射，后台 cron + 真实通知供应商；记录失败/未配置，幂等重试，不能假报已发送。
4. Google Sheets OAuth/服务账号、Excel 历史导入、GHL/Zoom 接口、正式佣金规则后再自动同步。

每月 5 Pinyu + 4 Chain 是排期参考，不是硬性校验。业务日期使用 Malaysia +08:00；时间保存带时区 ISO。自动按月生成活动需要实际日期、默认 PIC 和截止规则，未确认前不自动虚构场次。

## 尚需接通

公司身份网关/成员名单与角色、持久化服务器/代理/TLS、备份、通知供应商和 cron、Google Sheets 授权及实际 ID/tab、Zoom/GHL 数据和出席/成交归属规则、正式佣金规则。未访问真实客户数据或发送任何通知。第一阶段不部署、不自动修改远程表。
