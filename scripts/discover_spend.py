"""
discover_spend.py — 拉最近 N 天各账户 campaign 层级的真实花费+Lead，只显示有花费的。
帮我们锁定"真正在跑、要进报告"的 campaign。不打印 Token。
"""
import os, json, sys, urllib.parse, urllib.request
API="v21.0"; TOKEN=os.environ.get("META_ACCESS_TOKEN","")
if not TOKEN: raise SystemExit("没读到 META_ACCESS_TOKEN")
DAYS=int(sys.argv[1]) if len(sys.argv)>1 else 14
import datetime
until=datetime.date.today(); since=until-datetime.timedelta(days=DAYS-1)
LEADS={"lead","onsite_conversion.lead_grouped","offsite_conversion.fb_pixel_lead",
       "onsite_conversion.messaging_conversation_started_7d"}

def get(path,params):
    params=dict(params); params["access_token"]=TOKEN
    url=f"https://graph.facebook.com/{API}/{path}?"+urllib.parse.urlencode(params)
    with urllib.request.urlopen(url,timeout=90) as r: return json.loads(r.read().decode())

def leads(actions): return sum(float(a["value"]) for a in (actions or []) if a.get("action_type") in LEADS)

accts=get("me/adaccounts",{"fields":"id,name,currency","limit":200}).get("data",[])
print(f"\n最近 {DAYS} 天 ({since} ~ {until}) 有花费的 campaign：\n"+"="*66)
grand=0
for a in accts:
    try:
        rows=get(f"{a['id']}/insights",{"level":"campaign",
            "fields":"campaign_id,campaign_name,spend,inline_link_clicks,actions",
            "time_range":json.dumps({"since":str(since),"until":str(until)}),
            "limit":500}).get("data",[])
    except Exception as e:
        continue
    rows=[r for r in rows if float(r.get("spend",0) or 0)>0]
    if not rows: continue
    rows.sort(key=lambda r:-float(r.get("spend",0)))
    sub=sum(float(r.get("spend",0)) for r in rows)
    grand+=sub
    print(f"\n■ {a.get('name')}  ({a.get('id')})   小计 RM {sub:,.2f}")
    for r in rows:
        sp=float(r.get("spend",0)); ld=leads(r.get("actions")); ck=r.get("inline_link_clicks",0)
        cpl=f"RM {sp/ld:,.1f}" if ld else "—"
        print(f"   RM {sp:>8,.2f} | {int(ld):>3} lead | CPL {cpl:>9} | clk {ck} | {r.get('campaign_name')}")
        print(f"              campaign_id: {r.get('campaign_id')}")
print("\n"+"="*66+f"\n所有账户合计花费 RM {grand:,.2f}")
