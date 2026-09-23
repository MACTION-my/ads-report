"""
meta_ads_pull.py  —  从 Meta Marketing API 拉数据，生成 dashboard_data.json。
自动连接 Token 能访问的【全部广告户口】，把每个 campaign 按天的 花费/Lead/点击 记录下来。
分组（连锁/品誉/招聘 属于哪些户口）由前端页面上你自己勾选，这里不写死。
campaign_mapping.json 仅作可选覆盖：给某 campaign 起好名 label / 排除 exclude。
Token 从环境变量 META_ACCESS_TOKEN 读，绝不写进代码/仓库。
用法:  python scripts/meta_ads_pull.py
"""
import os, json, sys, urllib.parse, urllib.request, datetime
from collections import defaultdict
from process import build_dashboard_data

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API_VERSION = "v21.0"
TOKEN = os.environ.get("META_ACCESS_TOKEN", "")

DAYS = 60                        # 拉最近多少天（页面可再按日期筛选）
UNTIL = datetime.date.today()
SINCE = UNTIL - datetime.timedelta(days=DAYS - 1)
LEAD_ACTION = "lead"             # 统一 Lead 口径，避免同一批 lead 被多类型重复计算
MIN_SPEND = 1.0                  # 整段窗口总花费低于此的 campaign 跳过

import time, urllib.error
def api_get(path, params, retries=2):
    params = dict(params); params["access_token"] = TOKEN
    url = f"https://graph.facebook.com/{API_VERSION}/{path}?" + urllib.parse.urlencode(params)
    last = None
    for i in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            last = e
            if e.code < 500:      # 400 等永久错误：不重试，直接抛
                raise
            time.sleep(2 * (i + 1))
        except Exception as e:
            last = e; time.sleep(2 * (i + 1))
    raise last

def lead_value(actions):
    for a in (actions or []):
        if a.get("action_type") == LEAD_ACTION:
            return float(a["value"])
    return 0.0

def list_accounts():
    data = api_get("me/adaccounts", {"fields": "id,name", "limit": 500}).get("data", [])
    return [(a["id"], a.get("name", a["id"])) for a in data]

def fetch_daily(account_id):
    params = {"level": "campaign", "time_increment": 1,
              "fields": "campaign_id,campaign_name,spend,inline_link_clicks,actions,date_start",
              "time_range": json.dumps({"since": str(SINCE), "until": str(UNTIL)}),
              "limit": 500}
    rows, path = [], f"{account_id}/insights"
    while True:
        data = api_get(path, params)
        rows += data.get("data", [])
        nxt = data.get("paging", {}).get("next")
        if not nxt: break
        after = urllib.parse.parse_qs(urllib.parse.urlparse(nxt).query).get("after", [None])[0]
        if not after: break
        params["after"] = after
    return rows

def main():
    if not TOKEN:
        sys.exit("缺少 META_ACCESS_TOKEN 环境变量。")
    overrides = {k: v for k, v in json.load(open(os.path.join(ROOT, "campaign_mapping.json"),
                                                 encoding="utf-8")).items() if not k.startswith("_")}
    accounts = list_accounts()
    print(f"发现 {len(accounts)} 个广告户口，逐个拉取…")

    records = []
    total_spend = defaultdict(float)
    buf = []  # (account_id, account_name, campaign_id, campaign_name, date, spend, lead, clicks)
    for aid, aname in accounts:
        try:
            rows = fetch_daily(aid)
        except Exception as e:
            print(f"  [跳过] {aname} ({aid}) 读取失败: {e}"); continue
        for r in rows:
            cid = r.get("campaign_id")
            sp = float(r.get("spend", 0) or 0)
            total_spend[cid] += sp
            buf.append((aid, aname, cid, r.get("campaign_name", cid), r.get("date_start"),
                        round(sp, 2), round(lead_value(r.get("actions"))),
                        round(float(r.get("inline_link_clicks", 0) or 0))))

    for (aid, aname, cid, cname, d, sp, ld, ck) in buf:
        if total_spend[cid] < MIN_SPEND: continue
        ov = overrides.get(cid, {})
        if ov.get("exclude"): continue
        records.append({
            "account": aname, "account_id": aid, "campaign_id": cid,
            "label": ov.get("label") or cname, "variant": ov.get("variant"),
            "date": d, "spend": sp, "lead": ld, "clicks": ck,
        })

    out = build_dashboard_data(records, source="Meta Marketing API")
    open(os.path.join(ROOT, "dashboard_data.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, indent=1))
    print(f"[OK] {len(out['accounts'])} 户口 / {len(out['campaigns'])} 场 "
          f"-> dashboard_data.json (最新数据日 {out['report_date']})")

if __name__ == "__main__":
    main()
