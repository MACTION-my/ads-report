"""
diagnose_leads.py — 检测各 campaign 的花费与 Lead 计算。
把每个在跑 campaign 的 spend + 所有 action_type 明细都打出来，
方便和 Ads Manager 对照，确定正确的 Lead 口径。不打印 Token。
"""
import os, json, sys, urllib.parse, urllib.request, datetime
API="v21.0"; TOKEN=os.environ.get("META_ACCESS_TOKEN","")
if not TOKEN: raise SystemExit("没读到 META_ACCESS_TOKEN")
DAYS=int(sys.argv[1]) if len(sys.argv)>1 else 40
until=datetime.date.today(); since=until-datetime.timedelta(days=DAYS-1)

# 要检测的账户（两条线）
ACCTS={
 "act_1670543204163828":"Maction Franchise (Sandy)",
 "act_637010841817597":"Recruit Maction",
 "act_837976407618020":"M9品誉",
 "act_2070031456723180":"PINYU品誉",
 "act_3967944443497832":"Pinyu Malaysia (Adrian & Amanda)",
}
def get(path,params):
    params=dict(params); params["access_token"]=TOKEN
    url=f"https://graph.facebook.com/{API}/{path}?"+urllib.parse.urlencode(params)
    with urllib.request.urlopen(url,timeout=90) as r: return json.loads(r.read().decode())

print(f"检测区间 {since} ~ {until}\n"+"="*70)
for aid,aname in ACCTS.items():
    try:
        rows=get(f"{aid}/insights",{"level":"campaign",
            "fields":"campaign_name,spend,inline_link_clicks,actions,objective",
            "time_range":json.dumps({"since":str(since),"until":str(until)}),"limit":500}).get("data",[])
    except Exception as e:
        print(f"\n■ {aname}: 读取失败 {e}"); continue
    rows=[r for r in rows if float(r.get("spend",0) or 0)>0]
    if not rows: continue
    print(f"\n■ {aname} ({aid})")
    for r in rows:
        sp=float(r.get("spend",0))
        print(f"\n  · {r.get('campaign_name')}")
        print(f"    目标(objective)={r.get('objective')}  spend=RM {sp:,.2f}  clicks={r.get('inline_link_clicks')}")
        acts={a['action_type']:float(a['value']) for a in (r.get('actions') or [])}
        # 只显示可能和 lead 相关的类型 + 汇总
        for t in sorted(acts, key=lambda k:-acts[k]):
            if any(w in t for w in ('lead','messaging','conversion','complete_registration','submit')):
                print(f"        {t} = {acts[t]:.0f}")
print("\n"+"="*70+"\n看每个 campaign 的 objective 决定它的 Lead 该用哪个 action_type。")
