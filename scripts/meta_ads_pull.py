"""
meta_ads_pull.py  —  从 Meta Marketing API 拉数据，生成 dashboard_data.json。
按 campaign_mapping.json 工作：只拉登记过的 campaign，自动推导要访问的账户。
Token 从环境变量 META_ACCESS_TOKEN 读，绝不写进代码/仓库。
用法:  python scripts/meta_ads_pull.py
"""
import os, json, sys, urllib.parse, urllib.request
from collections import defaultdict
from process import build_dashboard_data

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API_VERSION = "v21.0"
TOKEN = os.environ.get("META_ACCESS_TOKEN", "")

# 时间范围：默认拉最近 40 天（覆盖当前所有在跑的场）。CI 里可按需改。
import datetime
UNTIL = datetime.date.today()
SINCE = UNTIL - datetime.timedelta(days=39)

# 哪些 action 算一个 Lead（Lead Form / WhatsApp / 网站 pixel 都覆盖）
LEAD_ACTION_TYPES = {
    "lead", "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.messaging_conversation_started_7d",
}

def api_get(path, params):
    params = dict(params); params["access_token"] = TOKEN
    url = f"https://graph.facebook.com/{API_VERSION}/{path}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=90) as resp:
        return json.loads(resp.read().decode())

def leads_from_actions(actions):
    return sum(float(a["value"]) for a in (actions or []) if a.get("action_type") in LEAD_ACTION_TYPES)

def fetch_daily(account_id):
    params = {"level": "campaign", "time_increment": 1,
              "fields": "campaign_id,spend,inline_link_clicks,actions,date_start",
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
    mapping = {k: v for k, v in json.load(open(os.path.join(ROOT, "campaign_mapping.json"),
                                              encoding="utf-8")).items() if not k.startswith("_")}
    accounts = sorted({m["account_id"] for m in mapping.values()})

    # 每个账户拉一次，按 campaign+date 取当天 spend/leads/clicks
    daily = defaultdict(lambda: {"spend": 0.0, "leads": 0.0, "clicks": 0.0})
    for acct in accounts:
        for row in fetch_daily(acct):
            cid = row.get("campaign_id")
            if cid not in mapping:   # 只保留登记过的 campaign
                continue
            k = (cid, row.get("date_start"))
            daily[k]["spend"] += float(row.get("spend", 0) or 0)
            daily[k]["leads"] += leads_from_actions(row.get("actions"))
            daily[k]["clicks"] += float(row.get("inline_link_clicks", 0) or 0)

    # 累计成"截至当天"的快照
    cum = defaultdict(lambda: {"spend": 0.0, "leads": 0.0, "clicks": 0.0})
    records = []
    for (cid, d) in sorted(daily, key=lambda k: (k[0], k[1])):
        v = daily[(cid, d)]; m = mapping[cid]
        c = cum[cid]
        c["spend"] += v["spend"]; c["leads"] += v["leads"]; c["clicks"] += v["clicks"]
        records.append({
            "line": m["line"], "account": m.get("account"), "label": m.get("label"),
            "marketer": m.get("marketer"), "variant": m.get("variant"),
            "report_date": d, "preview_date": m.get("preview_date"), "budget": m.get("budget"),
            "spend": round(c["spend"], 2), "received": round(c["leads"]),
            "used": None, "junk": None, "clicks": round(c["clicks"]),
        })

    out = build_dashboard_data(records, source="Meta Marketing API")
    open(os.path.join(ROOT, "dashboard_data.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, indent=1))
    print(f"[OK] 从 Meta 拉取 {len(records)} 条快照 / {len(out['campaigns'])} 场 "
          f"-> dashboard_data.json (报告日 {out['report_date']})")

if __name__ == "__main__":
    main()
