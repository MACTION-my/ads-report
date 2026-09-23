"""
process.py  —  把每日原始记录整理成 dashboard_data.json。
输入 record（每条 = 某 campaign 某天）:
  account, account_id, label, variant, date, spend, lead, clicks   （均为"当天"数值）
输出:
  report_date  最新数据日
  accounts     [{id, name, project}]  project=默认归类(连锁/品誉/招聘)，页面可改
  campaigns    [{account, account_id, label, variant, project, series:[{date,spend,lead,clicks}]}]
"""
from collections import defaultdict

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

def guess_project(name):
    n = (name or "").lower()
    if "recruit" in n or "招" in (name or "") or "门市" in (name or ""): return "招聘"
    if "品誉" in (name or "") or "pinyu" in n: return "品誉"
    return "连锁"

def build_dashboard_data(records, source="Meta Ads"):
    camps = defaultdict(list)
    for r in records:
        camps[(r.get("account_id"), r.get("label"), r.get("variant"))].append(r)

    campaigns, all_dates = [], set()
    acct_name = {}
    for (aid, label, var), rows in camps.items():
        rows = sorted(rows, key=lambda x: x["date"] or "")
        acct_name[aid] = rows[0].get("account")
        series = []
        for r in rows:
            d = r["date"]; all_dates.add(d)
            series.append({"date": d, "spend": round(num(r["spend"]), 2),
                           "lead": round(num(r["lead"])), "clicks": round(num(r["clicks"]))})
        disp = label + (f" ({var})" if var else "")
        campaigns.append({"account": rows[0].get("account"), "account_id": aid,
                          "label": disp, "variant": var,
                          "project": guess_project(rows[0].get("account")), "series": series})

    accounts = [{"id": aid, "name": nm, "project": guess_project(nm)}
                for aid, nm in acct_name.items()]
    accounts.sort(key=lambda a: (a["project"], a["name"]))

    return {"report_date": (max(all_dates) if all_dates else None),
            "accounts": accounts, "campaigns": campaigns, "generated_from": source}
