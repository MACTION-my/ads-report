# Google Sheets 迁移准备

用户确认：无自管服务器，成员为 Google Workspace / Gmail 混合账号。Google Drive 是历史报表来源和附件存储；Google Sheets 作为独立后台数据存储；Apps Script 负责未来服务端逻辑和定时任务。

目前 Node/SQLite 版本仍是完整的可测试实现。此目录提供 Google 后端表结构，尚未替代现有服务端。不要只把 SQLite 文件上传 Drive 作为数据库，也不要给团队直接编辑后台表的权限。

## 已检查的历史结构

- Pinyu / Franchise（Chain）都有 Conversion 和 Zoom Attendance List；旧版还含佣金说明。
- 一张 Conversion 可能有多个 GHL/Zoho 区块，相同人员可能出现多次。
- 同品牌同日期可能有多个文件；只有候选重复，不能按修改时间自动选最新版。
- 人员名称和 Manager 后缀不能作为登录身份，必须人工映射稳定 userId / 授权账号。
- 缺 newLeadPta，不猜算；不导入旧百分比公式。总计行不计入个人行。
- 旧佣金/奖励只保留来源值；不推导未来佣金规则或认定已批准。

legacy-import.mjs 提供只读预览解析，保留文件/区块/行号，校验错误、不明确身份和重复人员。它没有写入接口，不会自动合并区块或改动历史表。

## 下一步接入

1. 新建独立私有后台总表，按 sheet-schema.mjs 的稳定表头初始化，Sources 登记历史文件，Events/Stats 不凭文件名自动发布。
2. 注册实际 Admin 与成员邮箱，完成身份绑定。Apps Script 的 Session.getActiveUser 在个人 Gmail/跨组织模式可能为空，不能直接当混合账号登录。
3. 混合账号登录须配置真实 Google OAuth Web Client，验证可信 Google 身份并绑定 googleSubject；服务端从成员表加载角色，不能接受浏览器自报的邮箱/角色。此项尚未实现或授权。
4. Apps Script 单独项目与原广告 Apps Script 分开部署，以免替换现有 doGet/doPost。所有写入须服务端校验权限、版本及锁定状态；并发使用 LockService，设计失败回滚/日志，不能假设 Sheets 跨多次写入有 SQL 事务。
5. Apps Script 定时触发器生成催交；邮件发送需实际授权，未发送不记 sent。避免把会话/密钥存入可共享表，使用 Script Properties 等受限存储。
6. GitHub Pages /report/ 作固定入口，Google Web App 作为实际填报页面。连接器目前能管理 Drive/Sheets，不代表已部署 Apps Script、配置 OAuth 或开启定时器。

后台表仍是初始化状态，无真实成员注册、正式报表或通知配置。历史文件仍只读。
