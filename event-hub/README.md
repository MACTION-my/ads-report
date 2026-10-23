# Event Performance Hub

Google Sheets 方案的迁移准备见 [google/README.md](google/README.md)：已提供独立表结构及历史多区块只读解析器，当前尚未替换 Node/SQLite 服务端或上线 Google 填报服务。后台总表可建立不代表登录、填报及催交已经接通。

指定线上地址：`https://ads.aikpi.my/report`，由后端以 308 跳转 `/report/`（保留 query）。GitHub Pages API 已确认 ads.aikpi.my 是当前仓库的自定义域名；2026-10-23 现场检查首页为 200，/report 为 404。路径代码尚未部署。GitHub Pages 不能执行本模块的 Node API，也不能单独按路径转发到后端；需要在当前域名前增加反向代理/边缘路由，或迁移至支持后端的同站托管平台。不要只开启导航变量就声称已经绑定成功。

更新后的主流程：Admin 建活动并分配 telesales → 每位 telesales 登录后填写并提交本人数据 → 系统实时核算、显示缺报及催交 → PIC 汇总提交 → Admin 核准最终版。数据由团队直接填报，Google Sheets / GHL / Zoom 同步不是上线前提。PIC/Admin 保留补录及代填，记录操作人；代填也视为该成员已有数据。出席名单仍由 PIC/Admin 上传。

本人填报接口只更新本人一行，使用活动 revision 检测并发；同事先提交时需刷新再提交，防止覆盖。提交个人数据后，在全场提交锁定前可再次修改本人记录；全场已提交/最终版则锁定，须走退回更正。成员不能核准佣金/奖励。只读成员不能分配为填报人员。

同站增量模块，保留原 Ads Report；不是已上线服务。先读 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

## 本地验证

Node.js >=22.13（实际在 26.4.0 验证）。在本目录执行：

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run check
npm start
```

默认仅 localhost:8787，浏览器打开 http://127.0.0.1:8787/report/。未配身份网关返回明确未开放提示，数据库无示例用户和生产数据。没有默认账号或浏览器共享密码。测试用数据库独立、用后清理。

启动后可在本地运维终端登记**已经确认的公司身份 ID**（不是新增登录）：

```powershell
node admin.mjs 'D:\private-data\hub.sqlite' 'actual-company-sso-id' '姓名' admin
```

`EVENT_HUB_DB` 指向同一个私有持久化路径。`EVENT_HUB_PROXY_SECRET` 从部署密钥管理注入，至少 32 字符，不写文件、不进浏览器；不要把数据库放 GitHub Pages 或任何公开静态目录。生产以非管理员系统账号运行，限制数据库目录权限并定时备份；单实例写入。

## 接入公司系统

1. 选择实际公司身份网关（当前仓库没有 SSO），验证成员身份及停用账号流程。
2. 网关强制 TLS，删除所有客户端提交的 X-Hub-Secret / X-Hub-User，自行验证身份后注入真实 ID 和服务间 secret。关闭 API 直接公网入口。角色只读数据库，不能让用户选择。
3. 同站 `https://ads.aikpi.my/report/*` 转发到 localhost:8787，其余路径仍由现有广告站点提供。末尾 `/report/` 的斜杠不能省略；代理应将 `/report` 重定向到 `/report/`。
4. 在 staging 验证 Admin / PIC / Viewer、离职成员、跨站请求、移动填报、重启持久化、提交及退回、并发版本冲突、备份恢复。
5. 完成以上后才在仓库 Variables 设置 `EVENT_HUB_ENABLED=true`。现有每日生成脚本只在显式开启时增加 `/report/` 导航。默认不显示未接通入口。

现有 GitHub Pages workflow 不承载 Node API、数据库或后台任务。需要独立服务器/受支持的持久化托管及域名代理；本次没有部署或更改域名。

## CSV

绩效模板：`eventId,userId,newLeads,junk,pta,newLeadPta,attended,closedDeals,salesAmount,commission,dealIncentive,notes`。

从界面下载模板，ID 在活动详情和成员登记中获取。第一阶段固定表头，可调整列顺序，不支持任意 Excel 表头映射。一次导入一个活动。预览列出错误、警告、匹配人员。merge 更新 CSV 中匹配人员整行，保留其他人；replace 替换本场全部行。提交前必须补齐分配人员。PIC 不可改佣金/奖励；Admin 填 0 也代表明确核准。提交后如佣金未确认，需要退回由 Admin 核准再提交。

名单模板：`externalId,name,email,attended,userId`。externalId 必须是本场稳定唯一人员 ID，不是会议 ID；attended 用 0/1，userId 未确认归属可空。merge 按 externalId 更新，replace 替换名单。不同外部 ID 即使姓名相同也不会擅自合并，避免同名误匹配；换来源前需要统一 ID 映射。名单出席总数与填报出席不一致会提示，不自动覆盖。

不要直接上传现有 Zoom 报告或含百分比/公式的 XLSX；它们需要映射转换与授权。Google Sheets 的 spreadsheet ID、tab、权限和冲突策略未确认，未启用同步。汇总与人员绩效全团队可看，名单不出现在公共汇总、版本快照和绩效 CSV。

## 催交

```powershell
$env:EVENT_HUB_DB='D:\private-data\hub.sqlite'
node reminders.mjs
```

该命令由**服务器** cron / Windows Task Scheduler 每小时执行；不依赖浏览器。服务账号要有数据库写入权限。代码已经实现，真实调度尚未安装。四个窗口：活动次日、截止前一天、到期、逾期两天。任务晚启动时只生成当时最紧急窗口，不补发所有历史窗口。逾期升级给 PIC 及活跃 Admin；重复窗口不重复生成；submitted / finalized / cancelled / archived 停止新催交。站内待办在刷新页面时加载，已提交不再显示待办。

`delivered_in_app` 仅表示待办已持久化，不代表已读、邮件送达或 WhatsApp 送达；外部通道返回 not_configured。没有调用真实通知供应商。第一阶段没有提醒频率设置页面、邮件/WhatsApp、已读状态或重试外部投递。

## 本次边界

已提供可测试的管理、汇总、提交/审核、受限名单、站内待办、导入导出和浏览器打印 PDF。PDF 是浏览器打印保存，不是服务端生成。没有 XLSX 导入/导出、自动排期、客户级成交自动归属、Sheets/GHL/Zoom 同步或正式佣金算法。公司账号和真实数据连接未接通，所以目前不能免除所有人工确认。
