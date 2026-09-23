"""
discover.py  —  用你的 Token 列出可访问的广告账户 + 每个账户的 campaign。
只打印账户/campaign 的名字、ID、状态、预算 —— 绝不打印 Token 本身。
用来帮你建 campaign_mapping.json（哪个 campaign 属于哪一场课程）。
用法:  python discover.py
"""
import os, json, urllib.parse, urllib.request

API = "v21.0"
TOKEN = os.environ.get("META_ACCESS_TOKEN", "")
if not TOKEN:
    raise SystemExit("没读到 META_ACCESS_TOKEN。请先在 PowerShell 里设置好再跑。")

def get(path, params):
    params = dict(params); params["access_token"] = TOKEN
    url = f"https://graph.facebook.com/{API}/{path}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode())

def money(x):
    # Meta 预算单位是"分"，除 100
    return f"{int(x)/100:,.0f}" if x not in (None, "") else "-"

accts = get("me/adaccounts", {"fields": "id,account_id,name,currency,account_status", "limit": 200}).get("data", [])
print(f"\n可访问广告账户：{len(accts)} 个\n" + "="*60)
for a in accts:
    print(f"\n■ 账户: {a.get('name')}   ID: {a.get('id')}   币种: {a.get('currency')}")
    try:
        camps = get(f"{a['id']}/campaigns",
                    {"fields": "id,name,effective_status,daily_budget,lifetime_budget",
                     "limit": 200}).get("data", [])
    except Exception as e:
        print(f"   (读取 campaign 失败: {e})"); continue
    if not camps:
        print("   （没有 campaign）"); continue
    for c in camps:
        bud = c.get("daily_budget") or c.get("lifetime_budget")
        btype = "日预算" if c.get("daily_budget") else ("总预算" if c.get("lifetime_budget") else "")
        print(f"   - [{c.get('effective_status'):>8}] {c.get('name')}")
        print(f"       campaign_id: {c.get('id')}   {btype} {money(bud)}")
print("\n" + "="*60 + "\n完成。把上面这份列表理解一下，我们就能把每个 campaign 对应到课程场次。")
