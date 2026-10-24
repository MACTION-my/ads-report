# 验证记录 — 2026-10-23（马来西亚）

2026-10-24 Upcoming Events（dac8ae6，Google v14，Pages 40083215802 发布成功）：Dashboard 右下角第八张卡片，按当前筛选及 Malaysia 日期统计 eventDate 晚于今日的非取消/非归档活动；点击进入 Event Pipeline 并设 Upcoming 筛选，保留月份/品牌/PIC/搜索范围。卡片为键盘可操作的原生按钮。浏览器新增未来活动 fixture 验证计数与点击结果，同时发现前一版分屏导航遗漏 create/refresh/filter 事件绑定，已恢复并添加实际打开新建对话框、刷新、月份筛选的回归。38 项 Node 测试、2 项 Python、TypeScript strict、Build、语法与桌面/手机流程通过。正式网页确认八张卡片，当前十月 Upcoming 为0，点击可筛选空列表并恢复 All statuses。没有创建真实活动或新增服务连接。

2026-10-24 Dashboard 阻塞修复、号码转交和分屏导航（8794467，Google v13，Pages 40081753421 发布成功）：生产执行列表观察到长请求及约 20.7 秒请求；只读复现 hubStart 返回通用500。旧实现把登录、Dashboard读取与所有写入放同一 ScriptLock，可能被长写入阻塞。读取和登录不再等待写锁，写操作保留 1 秒 tryLock、503 繁忙提示及原子批量提交；写入元数据改为 Sheets API 单次读取，避免 SpreadsheetApp 多次同步调用，原表尾行清理保留。新增阻塞锁回归测试。

Admin Transfer number 在同一次 Members 原子提交中保留旧ID/姓名、清空其号码并停用，创建新 telesales ID 接同号码；旧统计、历史快照和活动分配不转移，不修改真实员工。Dashboard、Event Pipeline、Team Performance、Team Member 现在是按 hash 路由互斥显示的四个视图，手机有全部导航，成员页只给 Admin；支持直达及前进/后退。没有建立新后端或改变 OAuth scope。38 项 Node 测试、2 项 Python、TypeScript strict、Build、语法及桌面/手机流程通过；真实 hubStart/历史版本读取已恢复，24 场/68 条历史记录、6 个活跃账号与原金额核对通过。模拟 Google 浏览器验证号码转交和四页互斥。外部通知、自动 Drive 报表等未接通项不变。

2026-10-24 成员编辑和可恢复删除（b762a83，Google v12，Pages 40080533906 发布成功）：Admin Team Member 新增 Edit / Delete，可改名、手机号；不开放角色升级。删除使用既有 Members loginStatus=deleted 标记并 active=false，不删原始表行或历史绩效；主列表排除，Deleted members 可恢复，恢复后默认禁用登录。删除成员不可通过旧启用接口绕过恢复。保留手机号和姓名唯一性，历史身份不重新分配；Admin 受服务端保护。编辑、删除、恢复请求校验 memberVersion 防并发覆盖，审计不记录手机号。历史快照不重写，当前报表姓名随成员资料更新。36 项 Node 测试、2 项 Python、TypeScript strict、Build、语法、桌面/手机流程通过；模拟 Google 浏览器实际执行新增→编辑→删除→恢复。真实接口只读核对 24 场历史记录、68 条绩效、6 个活跃账号和原金额均保留。未编辑或删除真实成员；外部通知和自动 Drive 报表等接入范围不变。

2026-10-24 取消审批（d5cd709，Google v11，Pages 40080199887 发布成功）：移除 Submitted incl. finals 卡片。Admin/PIC 完成整场提交后直接 finalized，记录完成者/时间并生成最终版快照；无单独批准步骤。保留分配人员完整性、异常确认、版本冲突、锁定和退回更正；个人填报仍为 draft，避免提前锁定同事。未知佣金/奖励保留空值，不再等待批准。旧 submitted 记录在页面、Final 筛选/计数和月度导出中按完成记录兼容处理，不重写历史快照及原始金额。35 项 Node 测试、2 项 Python 生成测试、TypeScript strict、Build、语法和桌面/手机及 Google 模拟流程通过；发布后只读核对 24 场/68 条历史明细/6 个活跃账号及金额未变。首次沙箱 HTTP 回环 EACCES，获准重跑通过。外部通知、自动 Drive 报表等接入范围不变。

2026-10-24 转化率展示修正（e1de6ed，Pages 40079217339，Google v10 发布成功）：移除 Dashboard 按当前月份/筛选汇总的 Conversion Rates 卡片；打开单场活动后展示 Event Conversion Rates，并标注本场名称和日期，直接使用该报告服务端返回的 rates。原单人/单场 Total 转化率表格保留，金额及原始数据不变。35 项 Node 测试、TypeScript strict、Build、语法、桌面/手机及 Google 模拟流程通过；没有新增服务连接。

2026-10-24 成员管理与列表简化（a5f9ac4，Google v9，Pages 40079021812 发布成功）：左侧 Admin 专用 Team Member 入口，手机提供同名入口；列出手机号、角色、登录状态和历史数据可见范围。Admin 可新增普通 telesales 手机账号，服务端规范化号码、拒绝重复号码/姓名及非 Admin 调用；客户端传入 admin role 不会升级权限。沿用既有启停/隐私接口、原子提交、审计和会话活跃检查，不删除历史数据。普通成员接口不返回电话号码。移除侧栏重复 MACTION ACADEMY / Must Action.；活动列表移除 Deadline、Report status 两列，详情审核与催交保留。35 项 Node 测试、TypeScript strict、Build、语法和桌面/手机及 Google 模拟新增成员流程通过；真实账号未被新增或停用。发布后真实接口只读核对仍为 24 场历史记录、68 条绩效、6 个活跃账号，原金额全部吻合。可选 Node 后端不支持成员管理，通过 capability 隐藏入口；邮件/WhatsApp、自动 Drive 报表等未接通项不变。

2026-10-24 品牌名称统一（c24ae2f，Google v8，Pages 40060005052 发布成功）：用户将 Chain 改称 Franchise。登录页、筛选、创建活动、排期说明、现有活动标题、历史版本、通知及打印/导出文件名统一显示 Franchise；Node 和 Google 都接受 Franchise 新值，旧存储名称仍兼容读取。原事件 ID、历史快照原文、金额和人员归属不变，旧来源文件不重命名。未来保存使用 Franchise；旧品牌通过读取适配呈现，避免重写不可变快照。34 项 Node 测试、2 项 Python 生成测试、TypeScript strict、语法、Build 和桌面/手机及 Google 模拟管理流程通过。接入服务范围保持不变。

2026-10-24 管理员团队隐私（b541303，Google v7，Pages 发布 40059511373 成功）：Google 生产后端新增 team-visibility 管理接口，权限由服务端执行。隐藏名单保存在归档系统配置记录的 Events metadata 内，不改表头；普通业务列表和直达报告不会暴露配置记录。非 Admin 的成员列表、活动明细、Dashboard 聚合、历史版本、出席明细/摘要、活动 CSV 和月度 CSV 都按当前隐藏名单重新投影和核算；Admin 始终保留完整数据。含隐藏记录的活动禁止 PIC 批量改写/提交，但可安全提交本人行，避免删除不可见记录。隐藏与恢复、停用与恢复注册登录均 Admin 专用，设置有版本冲突校验及审计；Admin 账号不能在此停用。停用后已有会话下一次请求被现有活跃账号检查拒绝。

页面新增 Team privacy 按钮及手机卡片，分别提供 Hide data from team 和 Disable login；默认权限保持团队可看未隐藏活动数据，没有自动修改任何人的隐藏/登录设置。当前生产 Google Web App 已成功发布 v7（原网址、已有 OAuth scopes 和 Anyone 外壳设置不变），独立 Google 页面同步最新界面、品牌及移除广告入口。原始 Drive 报表共享不受此应用权限控制；自动 Drive 报表等未接通项仍未接通。可选 Node/SQLite 后端未新增此管理接口，界面通过服务端 capability 判断入口，不向旧后端显示不可用按钮。

验证：33 项 Node 测试、2 项 Python 生成、TypeScript strict、语法及 Node/Google Build 通过；新权限测试覆盖明细、列表、旧快照、名单、导出、恢复、并发冲突、本人写入保留隐藏行及停用账号。Google 模拟手机流程实际操作管理员隐藏按钮，确认成员无管理入口，管理员显示完整总额，手机无页面溢出。真实生产接口只读验证 Admin 能读取管理列表、成员调用得到 403、历史记录仍完整，未更改真实员工隐私或登录状态。

2026-10-24 排行榜人员移除（4941997，Pages 发布 40058454776 成功）：按用户指定，对四位历史人员在涉及活动的 metadata 记录 rankingExcludedUserIds，排行榜聚合跳过这些行；活动总计、原始绩效、金额、历史版本和账号状态均不变。界面只读取 ID 配置，真实姓名和 ID 未写入仓库。服务端回读核对原 24 场、68 条历史明细与六项总计全部不变。31 项测试、2 项 Python、TypeScript、语法及 Build 通过；桌面/手机流程通过，Google 模拟浏览器额外核对隐藏人员未上榜但收入仍保留。Submitted awaiting review 表示已提交待管理员审核，不自动最终确认。未接通的新服务范围与上阶段相同。

2026-10-24 历史数据与名单说明（6709828，Pages 发布 40057942358 成功）：通过已授权 Drive/Sheets 连接读取 29 个来源文件元数据，28 份活动表，经全精度个人行和原合计核对后迁入 24 场、68 条非空绩效记录。另按用户指示创建 3 场零数据待补活动，同日期重复文件只建一场，保留来源。确认过的日期冲突采用文件名日期；确认过的文字金额转换为数值并重算合计，原文件保持只读。不是负数；此前误判已向用户更正。快照状态为 submitted，未自动认定新系统最终审批。历史人员以禁用、无手机号的记录保留，6 个活跃登录账号未增加。原有系统数据、归档验证活动和原始 Drive 报表均保留。分母和总计由当前服务重算。

新增 history-plan.mjs，覆盖去重、全零模板跳过、历史身份不猜映射、金额校验、经用户确认的修正、来源审计和导入幂等；真实迁移请求和前后快照仅在忽略目录 qa/。Google Sheets 原子 batch 写入后，通过正式 API 验证 24 场 68 行全部六项总计与方案一致，3 场待补没有伪造人员行，活跃账号仍为 6。待补的内部截止占位值不显示为真实截止，编辑时必须填写实际截止和分配成员。名单依旧仅 Admin/PIC 可在可编辑活动上传标准 CSV，已增加具体指引及历史来源入口；历史人员排行名从报告记录解析。

31 项 Node 测试、2 项 Python 生成测试、TypeScript strict、语法、Build、桌面/手机保存提交审批及 Google 模拟手机登录流程通过。Back to Ads Report 已从所有角色及登录页彻底移除（覆盖此前管理员专属方案）。当前主域名前端接通已有 Google v6 API；自动在 Drive 按原版模板建报表、将名单同步到新文件、Excel/Zoom 原始格式直接识别、邮件/WhatsApp 仍未接通，未声称可用。

2026-10-24 品牌主题更新（5fa6255，Pages 发布 40056431674 成功，真实 Chrome 已核对）：登录及工作台背景统一米白 #f7f3e9，主色改为中国红 #e60012，移除粉红背景与主品牌渐层中的粉紫色；保持不同 KPI 的区分色。侧栏文案改为 MACTION / Must / Action，登录主标题同步 Must Action，favicon 同步中国红。25 项 Node、2 项 Python 测试、TypeScript、语法、Build、桌面/手机及 Google 模拟登录流程通过。后台及接入范围不变，更新面向公司域名入口。

2026-10-24 广告导航更新（a697c49，Pages 发布 40056277954 成功，线上登录页已核对）：登录页移除 Back to Ads Report，所有 Logo 留在 /report/。侧栏入口默认 hidden 且没有 href，仅认证结果为 admin 时设置目标并显示；退出及会话失效清除目标。25 项测试、2 项生成测试、TypeScript、语法及 Build 通过；浏览器验证登录前、成员登录、退出均无广告链接，管理员保留链接。此为导航显示控制，原公开广告页未新增访问认证；旧 Apps Script 独立页面未发布此界面变动。

2026-10-24 英文与鲜艳配色更新（代码 94f9b1f，GitHub Pages 发布 40053979590 成功）：公司域名 /report/ 的登录页改为红粉渐层，Dashboard 主指标采用红、蓝、绿、紫配色；标题、标签、数据和操作按钮字体放大加粗，保留清楚的边界。导航、筛选、状态、填报、确认弹窗、导入和提示统一英文；兼容后台中文校验消息的前端英文呈现，用户录入的名字、活动与备注不翻译。Google API、表格、权限及计算未修改；旧 Apps Script 直连页面未单独发布本次外观更新，主用入口为公司域名。

25 项 Node 测试、2 项 Python 生成测试、TypeScript strict、JS 语法和 Node/Google Build 通过。桌面与手机完成本人佣金填报、保存、提交、最终确认，未见 JS 错误或页面溢出；Google 模拟通讯验证一次合并登录、本人提交、退出，新增 390/1366px 登录无溢出及英文界面检查。截图在忽略目录 qa/。首次普通沙箱测试的本机 HTTP 连接被 EACCES 拦截，使用允许回环访问的测试环境后全套通过。

2026-10-24 业务定义更新：按用户新说明，New Lead 为广告线索、Junk 为无效/假线索、PTA 为答应出席、Attended 为最终出席、Closed Deal 为成交单数、Amount 为成交额。Lead→PTA 改为总 PTA / New Lead，另补 Lead→Attended；七项转化率自动计算，零分母保持 N/A。页面、报表、新 CSV 模板移除额外 newLeadPta，历史字段及旧 CSV 仍兼容。成员可手填本人 Commission；他人佣金及奖励权限仍受服务端保护，最终版仍须 Admin 确认。旧库未重建，未写入生产测试数据。

Google Web App v6 和独立前端部署 40052575746 已成功。真实 Google API 只读验证三项新分母通过。25 项自动测试、2 项 Python 生成测试、TypeScript strict、语法与 Build 通过；桌面/手机流程实际输入本人佣金、保存、提交和最终确认通过，Google 模拟通讯手机流程通过。首轮浏览器检查因仍使用旧佣金标签而未补齐空佣金导致最终确认失败，更新选择器并加入本人佣金保存断言后完整通过。历史迁移、GHL/Zoom 自动采集、邮件/WhatsApp 未新增连接。

以下为此前阶段记录；业务口径以本节用户最新确认定义为准。

框线与 Excel 对照更新：按用户反馈加深区块、指标卡、筛选栏、输入框边界；表格增加竖线和合计底色；成员填报分成线索与预约、出席与成交、佣金与奖励三个 fieldset。业务公式、权限和后台未修改。独立部署 39963110353 成功；25 项测试、2 项 Python 生成测试、TypeScript、语法与 Build 通过，桌面/手机保存提交审核、Google 模拟登录本人填报退出、空状态和弹窗检查通过。另用测试数据确认 fieldset 组的可访问名称和保存行为。

重新只读检查用户原始 Excel 的 Conversion 页：H 列采用总 PTA / New Leads，O 列标记 PTA to Won 却采用 Closed Deal / Attended。当前系统分别采用新线索 PTA / New Leads、Closed Deal / PTA，并另外提供 Closed Deal / Attended；旧表零分母有 IFERROR 0 和 DIV/0，当前用 N/A。主数值字段保留，佣金奖励仍由管理员核准；来源区块与历史数据尚未完整迁移。因此不能声称与原 Excel 完全相同。本次没有改变上述计算口径或原始工作簿。

以下为此前阶段记录。

登录性能更新：Google Web App v5 已发布，前端独立部署 39960647021 成功。实测同一网络下原流程（登录、me、events、inbox 四次串行请求）18,331ms，新版 hubStart 合并请求 3,010ms，减少约 84%；这是各一次实际 HTTP 测量，包含 Google 网络耗时，不代表所有设备或冷启动的固定时延。新增批量读取、启动只读六张表、一次恢复会话和即时加载指示。没有缓存角色或业务数据，仍检查账号启用状态。真实 Chrome 验证新版已有会话恢复、退出与重新登录。

25 项自动测试、2 项 Python 生成测试、TypeScript strict、语法检查与 Build 均通过；桌面/手机保存、提交、最终确认回归通过；Google 模拟通讯手机流程确认登录只调用一次 hubStart、没有重复初始化请求，再完成本人填报和退出。新增测试覆盖单次 batchGet、启动不返回手机号及停用账号后拒绝已有会话。未添加真实业务数据或接通新的通知服务。

以下为此前设计与部署记录。

UI / UX 设计更新：重做品牌欢迎登录页、桌面侧边导航、筛选栏、重点指标层级、转化区、活动状态标签、空数据提示、新建活动弹窗及手机样式。现有账号权限、数据来源、核算、提交和后台接口保持不变。前端以内容哈希给 CSS/JS 加版本 query，避免发布后仍使用旧资源。最终独立部署 39958691443 成功，真实 Chrome 在 ads.aikpi.my/report/?v=design1 登录管理员并读取总览，已保存线上欢迎页及工作台截图。

验证：24 项自动测试、2 项 Python 生成测试、TypeScript strict、语法检查和 Build 通过；原 Node 桌面/手机填报→草稿→提交→最终确认流程通过，Google 模拟通讯手机登录→本人填报→退出通过。另以测试账号检查 1366px 桌面与 390px 手机空活动状态和新建弹窗，无页面横向溢出；宽数据表在自身容器内滚动。检查截图后修正手机筛选按钮换行、空表居中与文字对比度。真实后台没有添加设计演示数据。邮件/WhatsApp、GHL/Zoom 等未连接状态未改变。

以下为此前功能与部署阶段记录。

公司域名原生页面更新（20:19 MYT）：已部署 Google Web App v4 的受限 doPost JSON 接口，GitHub Pages 直接提供 /report/ HTML、CSS、JS，不再重定向或使用 iframe。Chrome 实测在 https://ads.aikpi.my/report/?v=4 登录 Wilson、读取活动及成员总览、导出本月 CSV 成功，导出文件实际下载到 Downloads（当前无正式活动，CSV 只有表头）；全过程顶层地址保持 ads.aikpi.my。本机原生页面也验证了真实 API 登录、读取和退出。24 项自动测试、2 项 Python 生成测试、TypeScript strict、语法检查及 Build 通过。未重新创建正式业务数据，既有归档测试仍不参与总览。

发布记录：首轮 iframe 版本加载空白，未作为完成交付；已恢复 Google 默认禁止外站嵌入，改用无 Cookie 的 POST 会话传输。原 Daily 工作流 39951112198 因既有广告写 Google Sheet 步骤失败，未部署新页面。新增手动 Publish Event Report UI 流程，逐字节保留当时线上 Ads 首页后仅生成活动中心资源；首次校验误要求 html 外层标签而失败，检查真实首页为 title 起始片段后修正。最终独立部署 39952051514 成功，原广告抓取与写表脚本未改。该既有广告写表失败的根因尚未排查。原 /report 的跳转可能仍存在浏览器缓存，发布验证使用版本 query 避开缓存。

以下为历史部署记录，以本节公司域名原生页面更新为准。

正式部署更新（19:30 MYT）：用户完成首次 Google 授权后，独立 Web App 已发布版本 2，Anyone 入口已按用户明确选择启用。PR #1 已合并，GitHub Pages 工作流 39945762395 成功；实际浏览器从 https://ads.aikpi.my/report 跳转并显示手机号登录页。管理员真实登录、活动创建、绩效保存及刷新读回成功；修复 Google RPC 省略 null 时的前端 N/A 和汇总显示，23 项测试、TypeScript、语法和 Build 再次通过，CI 成功。验证活动已归档，正式总览为 0 场，测试记录保留审计。

每小时 runScheduledReminders_ 触发器已创建并在 Google Triggers 列表读回确认；尚未等待首次定时执行，不能声称实际到期催交已经验证。仅生成站内待办，没有邮件或 WhatsApp 通知。一次性拥有者安装函数仅存在未发布的编辑器 Head，执行后已移除并保存；没有进入公开部署。首次误运行默认 assert 的记录已核查，安装函数实际执行成功后输出 installed=true。历史表仅登记来源，未自动迁移正式数据。

以下为各阶段历史记录，状态以本节正式部署更新为准。

发布阶段实际状态：用户已明确同意 Anyone 互联网入口、手机号直接登录边界及 Google 表格/后台任务授权。已选择 Anyone 并提交部署；首次 Google OAuth 显示尚未验证应用，需本人处理提示。未完成授权、未发布、未安装定时触发器、未上线 /report。此前自动审批拒绝已在用户补充明确授权后继续，未绕过拒绝。

Google 运行版增量：按用户明确选择实现无密码手机号进入，Wilson 为 Admin，五位成员为 telesales（号码不在仓库）。新增 Google 业务服务、原子批量写入适配、会话到期/退出/停用、站内提醒、Google 通讯前端及 Apps Script 构建。23 项自动测试、TypeScript strict、JS 检查、Node/Google Build 通过；Google transport 手机流程通过（模拟通讯），原 Node 桌面/手机流程通过。Python 两项生成测试通过。已创建独立脚本并保存服务端/页面；Google 编辑器实际发现数字分隔符语法不兼容，已增加 ES2019 转译。尚未授权或发布，未以真实 Google 账号执行读写、建立触发器或上线 /report。不得把本地/模拟验证表述为 Google 端到端成功。

手机号成员登记增量：用户改为手机号登录。私有总表登记 5 位填报成员，规范化手机号，active=false / pending_setup，未推断管理员、未设置密码、未创建会话。真实电话号码未提交 GitHub。17 项测试、TypeScript strict、JS 语法及 Build 全通过。Google OAuth 不再作为该登录方案前提；实际手机号认证、密码方式和管理员权限仍待配置。

Google 迁移准备增量：16 项自动测试全部通过（新增历史日期解析、重复候选、多区块溯源、缺值/身份映射测试）；TypeScript strict、JS 检查和 Build 通过。已通过连接器建立原生 Google Sheets 后台结构并读回确认：11 个页签、Sources 18 条来源记录、Events/Stats/Members 无正式记录；权限元数据为 shared=false，只有拥有者。已将时区设为 Asia/Kuala_Lumpur。实际 Pinyu 和 Chain Conversion 样本分别识别 3 / 1 个区块，未提交写入。历史原表未改动；未把私有来源快照或业务数字提交 GitHub。表格工具导出后进程返回非零，但生成的 XLSX 经独立读取、原生转换及云端读回验证；未以退出码声称生成完全无误。Google 混合账号身份验证、Apps Script 服务与触发器仍未实现或部署。

域名路径增量：页面、API、导出、导航、测试及文档统一使用 /report/；/report 的 GET / HEAD 以 308 跳转 /report/ 并保留 query。真实 GitHub Pages API 确认自定义域名为 ads.aikpi.my；线上首页 HTTP 200、/report HTTP 404。修改仅在 PR 分支，不表示路径已经上线。

用户澄清后的增量：新增 telesales 本人填报及缺报人员催交，13 项测试全部通过，TypeScript strict、语法检查和 Build 通过。新增测试覆盖伪造他人 ID、未分配人员、只读成员、擅改佣金、版本冲突、保存不覆盖同事、个人填报后待办消失及全场锁定。

阶段 0：完整读取 brief，检查模板、Python 生成脚本、GitHub Pages workflow、Apps Script、git 状态及 Excel 的结构/公式。原仓库没有测试或 TypeScript / Build 工具，故没有可声称通过的原系统检查。

阶段 1：8 项核心及服务测试通过；TypeScript strict、JS 语法、构建通过。覆盖原始数字校验、六个 KPI、零分母、汇总、CSV、权限、提交锁定、退回及版本快照。首轮浮点严格断言失败，改为容差断言；首轮 TS 检查发现全局 name 冲突，前端改为 ES module。

阶段 2 / 名单和站内催交增量：12 项自动测试通过，含 HTTP 身份网关默认关闭、CSRF、名单明细隔离、导入去重、催交窗口幂等、SQLite 连接重启持久化。TypeScript strict、JS 语法及 build 通过。HTTP 回环请求在沙箱报 EACCES，获准在本机环境重跑通过；不是忽略该测试。

桌面 / 手机浏览器：使用本机 headless Edge、测试专用内存数据库及测试身份头，运行 load → 打开 → 保存 → 提交 → 最终确认。无 JS 异常、390px 手机页面无整体横向溢出；宽表在容器内水平滚动。真实公司 SSO 未测试。截图仅包含明确标记的测试数据；检查截图后调整了手机按钮换行和卡片栅格。

原广告生成回归：scripts/test_build_report.py 用临时 fixture 测试默认关闭入口及显式开启入口两个分支，1 个测试 / 2 个 subtest 通过，不覆盖原广告模板、index.html 或 dashboard_data.json。Windows 捕获输出编码错误通过测试环境设置 PYTHONIOENCODING=utf-8 修复。

新增 GitHub Actions 检查配置尚未在 GitHub 运行。没有 staging / production 部署；未验证域名反向代理、真实成员、真实业务数据、恢复备份、服务器 cron、邮件/WhatsApp、Sheets/GHL/Zoom 或实际 PDF 输出。构建输出不含数据库、用户账号或密钥。TypeScript 检查适用于 TS 前端；服务端为 JS，由语法检查与行为测试验证，不能称为全栈 TS。

尚未交付：自动排期、任意 Excel/Zoom 表头映射、XLSX 直接导入/导出、云端数据同步、正式佣金算法、通知配置页面、自动部署。完整业务自动化仍取决于实际数据来源及授权。
