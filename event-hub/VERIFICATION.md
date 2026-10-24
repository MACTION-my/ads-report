# 验证记录 — 2026-10-23（马来西亚）

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
