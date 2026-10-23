"""Build a same-domain /report entry; destination is configured only after Web App verification."""
import html
import os
from pathlib import Path
import re
import sys


def build(output_dir, enabled, url):
    destination = Path(output_dir) / 'report' / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    if enabled:
        if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', url or ''):
            raise ValueError('EVENT_HUB_WEBAPP_URL must be a verified Google Apps Script /exec URL')
        target = html.escape(url, quote=True)
        content = f'<meta http-equiv="refresh" content="0;url={target}"><p>正在进入活动中心… <a href="{target}">点此进入</a></p>'
    else:
        content = '<p>活动中心暂未开放，请联系管理员。</p>'
    destination.write_text('<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>活动绩效中心</title></head><body><h1>活动绩效中心</h1>' + content + '<p><a href="/">返回广告报告</a></p></body></html>', encoding='utf-8')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else '_site', os.environ.get('EVENT_HUB_ENABLED') == 'true', os.environ.get('EVENT_HUB_WEBAPP_URL', ''))
