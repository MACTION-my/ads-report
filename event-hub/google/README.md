# Google Sheets 迁移准备

用户确认：无自管服务器，改用手机号登录，不要求团队提供 Google 邮箱。Google Drive 是历史报表来源和附件存储；Google Sheets 作为独立后台数据存储；Apps Script 负责未来服务端逻辑和定时任务。手机号作账号或初始密码的具体方式尚待确认，当前没有可用登录凭据。

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
2. 注册实际 Admin 与手机号。手机号统一规范化为马来西亚 +60 格式，不从名称或电话猜测角色。已提供号码只写入私有后台，禁止提交 GitHub；新成员在登录方式及权限确定前 active=false、loginStatus=pending_setup。
3. 手机号是账号标识，不代表身份验证成功。待用户确定后实现服务端密码校验、限流、会话过期及退出；密码只能保存为加盐哈希。不能把共享口令或手机号清单放进前端。未配置真实短信供应商时不能声称有 SMS OTP / 短信催交。Google 登录不再是该方案前提。
4. Apps Script 单独项目与原广告 Apps Script 分开部署，以免替换现有 doGet/doPost。所有写入须服务端校验权限、版本及锁定状态；并发使用 LockService，设计失败回滚/日志，不能假设 Sheets 跨多次写入有 SQL 事务。
5. Apps Script 定时触发器生成催交；邮件发送需实际授权，未发送不记 sent。避免把会话/密钥存入可共享表，使用 Script Properties 等受限存储。
6. GitHub Pages /report/ 作固定入口，Google Web App 作为实际填报页面。连接器目前能管理 Drive/Sheets，不代表已部署 Apps Script、配置 OAuth 或开启定时器。

后台表仍是初始化状态，成员登记不等于可登录，没有正式报表或通知配置。历史文件仍只读。
