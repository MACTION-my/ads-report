"""Publish first-party UI assets with a verified Google Apps Script API endpoint."""
import html
import os
from pathlib import Path
import re
import sys
import shutil


def build(output_dir, enabled, url):
    destination = Path(output_dir) / 'report' / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    if enabled:
        if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', url or ''):
            raise ValueError('EVENT_HUB_WEBAPP_URL must be a verified Google Apps Script /exec URL')
        target = html.escape(url, quote=True)
        public = Path(__file__).resolve().parent.parent / 'event-hub' / 'public'
        content = (public / 'index.html').read_text(encoding='utf-8')
        content = content.replace('<head>', f'<head><meta name="event-hub-endpoint" content="{target}">')
        for asset in ['app.js', 'styles.css']:
            shutil.copyfile(public / asset, destination.parent / asset)
        destination.write_text(content, encoding='utf-8')
        return
    else:
        content = '<p>活动中心暂未开放，请联系管理员。</p>'
    destination.write_text('<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>活动绩效中心 · MACTION</title><style>html,body{margin:0;width:100%;height:100%;background:#fafafa}iframe{display:block;border:0;width:100%;height:100vh;height:100dvh}p{padding:24px;font:16px/1.6 sans-serif}</style></head><body>' + content + '</body></html>', encoding='utf-8')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else '_site', os.environ.get('EVENT_HUB_ENABLED') == 'true', os.environ.get('EVENT_HUB_WEBAPP_URL', ''))
