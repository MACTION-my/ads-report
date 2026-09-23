"""
process.py  —  把"原始快照记录"整理成 dashboard 需要的 dashboard_data.json。
Excel 路径和 Meta API 路径都调用这里，保证报告口径一致。

原始记录 (raw record) 每条 = 某场某天的一个快照，字段:
  line        业务线: "Maction" / "Pinyu"
  account     广告账户名（报告里可按账户筛选；Excel 路径可留空）
  label       场标题（卡片标题）；没有则按 line 生成默认名
  marketer    可选，marketer/账号名
  variant     广告组: None / "A" / "B"
  report_date 数据日期  "YYYY-MM-DD"
  preview_date讲座/课程日期 "YYYY-MM-DD" 或 None
  budget      预算 (RM) 或 None
  spend       截至当天累计花费
  received    累计 Lead 数
  used/junk   有效/垃圾 Lead（人工；API 没有则 None）
  clicks      累计链接点击
"""
from collections import defaultdict

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

def _default_label(line, marketer):
    if line == "Maction": return "Maction 连锁课程"
    return "品誉绩效课程" + (f" · {marketer}" if marketer else "")

def build_dashboard_data(records, source="Meta Ads"):
    camps = defaultdict(list)
    for r in records:
        key = (r.get("line"), r.get("account"), r.get("label"), r.get("preview_date"), r.get("variant"))
        camps[key].append(r)

    campaigns, all_dates = [], set()
    for (line, account, label, prev, var), rows in camps.items():
        rows = sorted(rows, key=lambda x: x["report_date"] or "")
        series, prev_spend, prev_lead = [], None, None
        for r in rows:
            d = r["report_date"]; all_dates.add(d)
            sp, ld = num(r["spend"]), num(r["received"])
            budget = None if r.get("budget") in (None, "") else num(r["budget"])
            d_sp = sp - prev_spend if prev_spend is not None else sp
            d_ld = ld - prev_lead if prev_lead is not None else ld
            reset = False
            if d_sp < 0:
                reset, d_sp, d_ld = True, sp, ld
            series.append({
                "date": d, "spend": round(sp, 2), "lead": round(ld),
                "cpl": round(sp / ld, 4) if ld > 0 else 0,
                "budget": budget, "bal": (None if budget is None else round(budget - sp, 2)),
                "used": (None if r.get("used") is None else round(num(r["used"]))),
                "junk": (None if r.get("junk") is None else round(num(r["junk"]))),
                "clicks": round(num(r["clicks"])),
                "d_spend": round(d_sp, 2), "d_lead": round(d_ld), "reset": reset,
                "day_cpl": round(d_sp / d_ld, 2) if d_ld > 0 else None,
            })
            prev_spend, prev_lead = sp, ld
        disp = label or _default_label(line, rows[0].get("marketer"))
        if var: disp += f" ({var})"
        campaigns.append({"line": line, "account": account, "marketer": rows[0].get("marketer"),
                          "variant": var, "preview_date": prev, "label": disp, "series": series})

    # 账户列表（给筛选用），保持出现顺序
    accounts = []
    for c in campaigns:
        if c["account"] and c["account"] not in accounts:
            accounts.append(c["account"])

    return {"report_date": (max(all_dates) if all_dates else None),
            "accounts": accounts, "campaigns": campaigns, "generated_from": source}
