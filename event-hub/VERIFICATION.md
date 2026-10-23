# 验证记录 — 2026-10-23（马来西亚）

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
