"""probe_business.py — 看 Token 能访问几个户口、Business 里共有多少户口。不打印 Token。"""
import os, json, urllib.parse, urllib.request
API="v21.0"; TOKEN=os.environ.get("META_ACCESS_TOKEN","")
if not TOKEN: raise SystemExit("no token")
def get(path,params):
    params=dict(params); params["access_token"]=TOKEN
    url=f"https://graph.facebook.com/{API}/{path}?"+urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url,timeout=60) as r: return json.loads(r.read().decode())
    except Exception as e:
        return {"__error__":str(e)}

me=get("me/adaccounts",{"fields":"id,name","limit":500})
accs=me.get("data",[])
print(f"Token 现在能访问的广告户口：{len(accs)} 个")
for a in accs: print("   -", a.get("name"), a.get("id"))

biz=get("me/businesses",{"fields":"id,name","limit":50})
if "__error__" in biz:
    print("\n无法列出 Business（Token 没有 business_management 权限，正常）：", biz["__error__"])
else:
    for b in biz.get("data",[]):
        print(f"\nBusiness: {b.get('name')} ({b.get('id')})")
        for kind in ("owned_ad_accounts","client_ad_accounts"):
            r=get(f"{b['id']}/{kind}",{"fields":"id,name","limit":500})
            if "__error__" in r: print(f"   {kind}: 读不到 ({r['__error__']})")
            else: print(f"   {kind}: {len(r.get('data',[]))} 个")
