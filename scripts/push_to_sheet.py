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

    # 2) 课程列表：算 花费/Lead 回填
    def resolve(val):
        val = (val or "").strip()
        if not val: return set()
        if val in ("连锁", "品誉", "招聘"):
            return {a["id"] for a in accounts if a["project"] == val}
        ids = set()
        for part in val.replace("，", ",").split(","):
            p = part.strip()
            for a in accounts:
                if p and (p == a["name"] or p in a["name"]): ids.add(a["id"])
        return ids
    def calc(acct_ids, d1, d2):
        sp = ld = 0
        for c in camps:
            if c["account_id"] not in acct_ids: continue
            for s in c["series"]:
                if d1 <= s["date"] <= d2: sp += s["spend"]; ld += s["lead"]
        return round(sp, 2), round(ld)

    try:
        cr = get("courses").get("rows", [])
    except Exception as e:
        print("读课程列表失败(跳过):", e); cr = []
    updates = []
    for i, row in enumerate(cr[1:], start=2):   # 第2行起是数据；表格行号=i
        row = list(row) + [""] * 13
        acct, d1, d2 = row[6], str(row[4])[:10], str(row[5])[:10]
        ids = resolve(acct)
        if ids and d1 and d2 and d1 != "" and d2 != "":
            sp, ld = calc(ids, d1, d2)
            updates.append({"row": i, "spend": sp, "lead": ld})
    if updates:
        print("课程花费回填:", post({"token": TOKEN, "action": "course_calc", "updates": updates}))
    else:
        print("课程列表暂无可计算的行")

if __name__ == "__main__":
    main()
