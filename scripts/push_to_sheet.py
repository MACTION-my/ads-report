"""
push_to_sheet.py — 把数据写进 Google Sheet（通过 Apps Script Web App）。
1) 每日广告数据：把最近 N 天每场每天的 花费/Lead/点击 upsert 进「每日广告数据」分页（永久历史）。
2) 课程列表：读「课程列表」里每行的 户口/项目 + 广告从/到，算出 花费/Lead 回填。
环境变量:  SHEET_WEBAPP_URL, SHEET_TOKEN
用法:  python scripts/push_to_sheet.py [--days N]
"""
import os, sys, json, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
URL = os.environ.get("SHEET_WEBAPP_URL", "")
TOKEN = os.environ.get("SHEET_TOKEN", "")
DAYS = 7
if "--days" in sys.argv: DAYS = int(sys.argv[sys.argv.index("--days") + 1])

def post(payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())

def get(tab):
    u = URL + ("&" if "?" in URL else "?") + "tab=" + tab
    with urllib.request.urlopen(u, timeout=120) as r:
        return json.loads(r.read().decode())

def main():
    if not URL or not TOKEN:
        print("未配置 SHEET_WEBAPP_URL / SHEET_TOKEN，跳过写入 Google Sheet。"); return
    data = json.load(open(os.path.join(ROOT, "dashboard_data.json"), encoding="utf-8"))
    camps = data["campaigns"]; accounts = data["accounts"]
    cutoff = (datetime.date.today() - datetime.timedelta(days=DAYS - 1)).isoformat()

    # 1) 每日广告数据 upsert
    rows = []
    for c in camps:
        for s in c["series"]:
            if s["date"] < cutoff: continue
            rows.append([s["date"], c["project"], c["account"], c["label"],
                         s["spend"], s["lead"], s["clicks"], c["account_id"], c.get("campaign_id", "")])
    if rows:
        print("每日广告数据:", post({"token": TOKEN, "action": "daily", "rows": rows}))

    # 课程列表的 花费/Lead 由用户在 Google Sheet 手动填写，脚本不改动（避免覆盖手填值）。

if __name__ == "__main__":
    main()
