# 每日广告报告 (Daily Ads Report)

课程广告每日自动报告：直接从 **Meta Ads Manager (Marketing API)** 拉取花费、Lead、Cost per Lead，
按广告账户/业务线汇总，生成一个网页 dashboard。覆盖 **Maction 连锁** 与 **品誉绩效** 两条线。

## 自动化流程（GitHub Actions）
每天由 `.github/workflows/daily.yml` 定时运行（马来西亚时间早上 9 点）：
1. `scripts/meta_ads_pull.py` —— 用 Token 从 Meta 拉数据 → `dashboard_data.json`
2. `scripts/build_report.py` —— 把数据注入 `daily_ads_dashboard.html` → `index.html`
3. 发布到网页（GitHub Pages / Cloudflare Pages），团队打开固定网址即可看。

## 配置
- **Token**：存在仓库 Secrets 里的 `META_ACCESS_TOKEN`（Settings → Secrets and variables → Actions）。绝不写进代码。
- **场次对应表**：`campaign_mapping.json` —— 每个 Meta `campaign_id` 对应到 业务线 / 账户 / 场标题 / 讲座日期 / 预算。要加/改场次或预算，改这个文件即可。

## 手动重跑
在 GitHub 仓库 **Actions → Daily Ads Report → Run workflow** 可随时手动触发。

## 文件
| 文件 | 作用 |
|---|---|
| `.github/workflows/daily.yml` | 每日定时自动化 |
| `scripts/meta_ads_pull.py` | 从 Meta API 拉数据 |
| `scripts/process.py` | 算每日增量 / CPL / 预算余额 |
| `scripts/build_report.py` | 把数据注入报告模板 |
| `scripts/discover.py` / `discover_spend.py` | 列账户 / campaign，帮助维护对应表 |
| `campaign_mapping.json` | campaign → 场次 对应表 |
| `daily_ads_dashboard.html` | 报告模板（含筛选、图表） |
