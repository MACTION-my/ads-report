"""
meta_ads_pull.py  —  从 Meta Marketing API 拉数据，生成 dashboard_data.json。
按【广告账户】抓：只要在下面 ACCOUNTS 里的账户，所有有花费的 campaign 都会自动进报告
（新开的 campaign 无需手动登记就会自动显示）。
campaign_mapping.json 只作"美化/补充"：给某个 campaign 起好听的场名、填讲座日期/预算/广告组，
或用 "exclude": true 把某个 campaign 排除。
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

# ========== 要纳入报告的广告账户（新增账户就加一行） ==========
ACCOUNTS = {
    "act_1670543204163828": {"line": "Maction", "name": "Maction Franchise (Sandy)"},
    "act_637010841817597":  {"line": "Maction", "name": "Recruit Maction"},
    "act_837976407618020":  {"line": "Pinyu",   "name": "M9品誉"},
    "act_2070031456723180": {"line": "Pinyu",   "name": "PINYU品誉"},
    "act_3967944443497832": {"line": "Pinyu",   "name": "Pinyu Malaysia (Adrian & Amanda)"},
}

# 拉取窗口（天）。累计 = 该窗口内累计。当日增量不受影响。
DAYS = 45
UNTIL = datetime.date.today()
SINCE = UNTIL - datetime.timedelta(days=DAYS - 1)

# Lead 口径：用统一的 "lead" 一个即可（避免同一批 lead 被多种类型重复计算）
LEAD_ACTION = "lead"
MIN_SPEND = 1.0   # 整段窗口总花费低于这个就不进报告（滤掉噪声）

def api_get(path, params):
    params = dict(params); params["access_token"] = TOKEN
    url = f"https://graph.facebook.com/{API_VERSION}/{path}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=90) as resp:
        return json.loads(resp.read().decode())

def lead_value(actions):
    for a in (actions or []):
        if a.get("action_type") == LEAD_ACTION:
            return float(a["value"])
    return 0.0

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

    # 每账户每 campaign 每天的 spend/leads/clicks + campaign 名字
    daily = defaultdict(lambda: {"spend": 0.0, "leads": 0.0, "clicks": 0.0})
    cname = {}; total_spend = defaultdict(float)
    for aid, meta in ACCOUNTS.items():
        for row in fetch_daily(aid):
            cid = row.get("campaign_id")
            cname[cid] = row.get("campaign_name", cid)
            k = (aid, cid, row.get("date_start"))
            sp = float(row.get("spend", 0) or 0)
            daily[k]["spend"] += sp
            daily[k]["leads"] += lead_value(row.get("actions"))
            daily[k]["clicks"] += float(row.get("inline_link_clicks", 0) or 0)
            total_spend[cid] += sp

    # 累计成"截至当天"的快照
    cum = defaultdict(lambda: {"spend": 0.0, "leads": 0.0, "clicks": 0.0})
    records = []
    for (aid, cid, d) in sorted(daily, key=lambda k: (k[1], k[2])):
        if total_spend[cid] < MIN_SPEND:      # 整段几乎没花钱的跳过
            continue
        ov = overrides.get(cid, {})
        if ov.get("exclude"):                  # 手动排除的跳过
            continue
        v = daily[(aid, cid, d)]; c = cum[cid]
        c["spend"] += v["spend"]; c["leads"] += v["leads"]; c["clicks"] += v["clicks"]
        records.append({
            "line": ACCOUNTS[aid]["line"],
            "account": ACCOUNTS[aid]["name"],
            "label": ov.get("label") or cname.get(cid),   # 有起好的名用它，否则用 campaign 原名
            "variant": ov.get("variant"),
            "report_date": d,
            "preview_date": ov.get("preview_date"),
            "budget": ov.get("budget"),
            "spend": round(c["spend"], 2), "received": round(c["leads"]),
            "used": None, "junk": None, "clicks": round(c["clicks"]),
        })

    out = build_dashboard_data(records, source="Meta Marketing API")
    open(os.path.join(ROOT, "dashboard_data.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, indent=1))
    print(f"[OK] 从 Meta 拉取（近 {DAYS} 天）{len(out['campaigns'])} 场 / {len(ACCOUNTS)} 账户 "
          f"-> dashboard_data.json (报告日 {out['report_date']})")

if __name__ == "__main__":
    main()
