# 验证记录 — 2026-10-23（马来西亚）

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
