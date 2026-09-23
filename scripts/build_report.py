"""
build_report.py  —  把 dashboard_data.json 注入 HTML 模板，生成当天报告。
用法:  python build_report.py [dashboard_data.json] [daily_ads_dashboard.html]
这是"最后一步"：不管数据来自 Excel 还是 Meta API，都生成同一个 dashboard。
"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
data_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dashboard_data.json")
html_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "daily_ads_dashboard.html")

data = open(data_path, encoding="utf-8").read().strip()
json.loads(data)  # 校验是合法 JSON

html = open(html_path, encoding="utf-8").read()
new = re.sub(r"/\*DATA_START\*/.*?/\*DATA_END\*/",
             "/*DATA_START*/" + data.replace("\\", "\\\\") + "/*DATA_END*/",
             html, count=1, flags=re.S)
if new == html:
    raise SystemExit("找不到 /*DATA_START*/.../*DATA_END*/ 标记，请确认用的是带标记的 HTML 模板。")

open(html_path, "w", encoding="utf-8").write(new)
rd = json.loads(data).get("report_date", "?")
print(f"[OK] 报告已生成: {html_path}  (报告日 {rd})  —— 双击这个 HTML 即可查看。")
