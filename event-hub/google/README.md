# Google Sheets / Apps Script 运行方式

## Calendar 单向排期同步（代码完成，待拥有者授权和正式发布）

Calendar v3 高级服务及 calendar.events.readonly scope 用于仅读取活动。默认关闭；HUB_CALENDAR_ENABLED=true 才执行，HUB_CALENDAR_ID 默认为拥有者 primary。正式开启前必须取得拥有者对新增 Calendar 读取权限的确认并完成 Google 授权。已有小时站内提醒任务完成后执行同步，不另建重复触发器。Admin 在 Event Pipeline 可打开 Sync Calendar 查看连接状态、最后成功时间和错误，并 Sync now；普通成员无控制按钮或接口权限。

读取过去60天至未来180天，分页完成后再拿写锁加载最新表并单批原子提交。已有链接即使改期到窗口外也按稳定 Calendar event ID 追踪；循环活动按 API 展开的 instance ID 区分。新建只含今天起的未来课程，过去未建报表的课程不补造业绩。业务课程按标题识别：Pinyu/绩效/品育，Franchise/连锁（包括 JB OFFLINE）、AI Agent/课程，以及其他 course/workshop/seminar/training/中文课程关键词。原始课程名保留；无匹配关键词的新课程名称需要扩充规则。私人标记、Gmail旅行、节假日和非课程条目跳过。仅保留课程标题、日期/起止时间、场地和来源ID，不复制说明、参与者或附件。

新场 scheduled、零业绩、无分配团队，PIC 暂为运行同步的 Admin，须由 Admin 分配人员后填报。同品牌同日仅在唯一且线上/线下/课程类型匹配时关联既有报告，不明确者返回 review，不自动重建。已删除/归档不复活；日历取消或不可读只提示核对，不删除系统记录。有业绩/名单/最终版，或系统手工修改过的字段，遇源排期变化保留原值并显示 Admin review；空白未手改活动可以更新排期。自动默认截止随日期移动，手动截止须核对。业绩、名单、成员账号、隐私及历史版本不写入本模块。Calendar 到系统单向同步不改日历、不接通 Drive 模板复制或报表导出。

用户明确选择：只输入已登记的手机号即可进入，无密码、无 OTP，知道登记号码即具有相应成员访问能力。Wilson 为 Admin，其余已提供的五位为 telesales。实际号码只保存在私有 Members 表，不进入代码仓库。Google Drive 存放历史来源/附件，Google Sheets 为后台存储，Apps Script 运行服务端和站内催交。

Google 版本已实现并可独立构建，Node/SQLite 版保留作本地参考。Google Web App 需要在真实账号中授权、发布、验证后才可称为上线。后台表只供拥有者直接编辑，团队经页面访问。不要把 SQLite 文件上传 Drive 作为数据库。

## 构建与文件

登录性能：新版前端以 hubStart 一次取得会话、成员列表、活动和提醒；已有会话通过 hubCall 的 bootstrap 路径一次恢复。Runtime 以 Sheets Values.batchGet 批量读取启动所需六张表，不读取历史行快照、导入日志、审计和来源目录；普通业务请求仍可读取完整表集。成员与启用状态每次重新读取，未缓存角色或业务报表。hubLogin 保留供旧前端兼容，仅读取 Members。写入仍受 ScriptLock 和原子 batchUpdate 保护。

本目录 sheet-service.mjs 是纯业务服务，复用 core.mjs 的校验及 KPI；sheet-state.mjs 处理分位金额和表结构；phone-sessions.mjs 处理手机号进入、六小时会话、退出及停用；Runtime.gs 处理 Google 读写与公开 RPC；build.mjs 生成 build/Code.gs、Index.html 和 appsscript.json（不包含手机号或真实账号）。主目录 npm run build 同时构建两种运行方式。Apps Script 的解析器不支持某些新语法，构建会转为 ES2019。

所有会话存在 Script Cache，仅保存 token 摘要、成员 ID、到期时间；Cache 可能提前淘汰，会要求重新登录。每次 RPC 重新读取活跃成员/角色，不接受客户端指定角色。资料编辑、提交、退回、佣金核准、名单权限与版本仍服务端执行。

写入在 Script Lock 下读取最新数据、核对 revision，并把变更表组成一个 Sheets API batchUpdate 原子提交。失败不退化为连续 setValues。当前按约每月九场、少量成员设计，每表最多 20,000 行，每格 JSON 最多 45,000 字符，超限拒绝操作；需扩容时再调整存储方案。Sources 是只读来源登记，不会自动合并历史报表。

## 已检查的历史结构

- Pinyu / Franchise都有 Conversion 和 Zoom Attendance List；旧版还含佣金说明。
- 一张 Conversion 可能有多个 GHL/Zoho 区块，相同人员可能出现多次。
- 同品牌同日期可能有多个文件；只有候选重复，不能按修改时间自动选最新版。
- 人员名称和 Manager 后缀不能作为登录身份，必须人工映射稳定 userId / 授权账号。
- 缺 newLeadPta，不猜算；不导入旧百分比公式。总计行不计入个人行。
- 旧佣金/奖励只保留来源值；不推导未来佣金规则或认定已批准。

legacy-import.mjs 提供只读预览解析，保留文件/区块/行号，校验错误、不明确身份和重复人员。它没有写入接口，不会自动合并区块或改动历史表。

## 下一步接入

1. 新建独立私有后台总表，按 sheet-schema.mjs 的稳定表头初始化，Sources 登记历史文件，Events/Stats 不凭文件名自动发布。
2. Members 使用稳定 ID，phone 为 +60 文字，loginStatus=phone_only、active=true 才能进入；角色仅允许实际授权的 Admin / PIC / telesales / viewer。未经授权不得自行升权。
3. 在独立 Apps Script 项目粘贴构建的三份文件，避免覆盖广告脚本。Script Properties 设置 HUB_SPREADSHEET_ID 为私有总表 ID，HUB_PHONE_ONLY_ENABLED=true 才开放号码登录。清单启用 Sheets 高级服务并声明 spreadsheets 和 script.scriptapp scopes，首次授权必须由拥有者确认。
4. Web App 执行为拥有者，允许 Anyone 进入外壳；未登记/停用号码拒绝进入数据接口。发布会创建可公开访问的应用地址，因此需在最终发布前确认设置与访问模式。
5. 手动在编辑器运行 installHubTrigger_ 建立每小时任务（已存在则不重复安装）。它只生成站内待办；不发送邮件、短信或 WhatsApp。runScheduledReminders_ 和安装函数以 _ 结尾，不可从 google.script.run 调用。
6. 在独立测试总表验证真实 Sheets 原子写入、两个角色、提交版本、退出、定时器后，才能开放正式数据。GitHub Variables 设置 EVENT_HUB_WEBAPP_URL 为已验证的 Google /exec URL，EVENT_HUB_ENABLED=true。scripts/build_hub_entry.py 发布原生页面与静态资源，meta 配置公开 API 地址。页面以 text/plain POST 调用 doPost，再由 ContentService 返回 JSON；手机号和令牌放在请求体，不进入 URL 或仓库。接口不使用 Cookie，所有业务权限仍通过现有会话和角色检查。独立 Google 页面继续可用，默认不允许跨站嵌入。

当前尚待真实授权/部署验证；后台没有正式活动数字，历史文件只读。已有完整本地及模拟 Google 通讯测试不能替代线上测试。
