"""Regression checks with disposable fixtures; does not overwrite report files."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class BuildReportTest(unittest.TestCase):
    def test_existing_build_default_and_opt_in_navigation(self):
        builder = Path(__file__).with_name('build_report.py')
        for enabled in ('', 'true'):
            with self.subTest(enabled=enabled), tempfile.TemporaryDirectory(dir=builder.parent.parent / 'event-hub') as directory:
                data = Path(directory) / 'data.json'
                html = Path(directory) / 'report.html'
                data.write_text(json.dumps({'report_date': '2026-10-23'}), encoding='utf-8')
                html.write_text('<h1>Ads Report</h1><script>const D=/*DATA_START*/{}/*DATA_END*/;</script>', encoding='utf-8')
                result = subprocess.run([sys.executable, str(builder), str(data), str(html)],
                                        env={**os.environ, 'EVENT_HUB_ENABLED': enabled, 'PYTHONIOENCODING': 'utf-8'}, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                built = html.read_text(encoding='utf-8')
                self.assertIn('2026-10-23', built)
                self.assertEqual('/events/' in built, enabled == 'true')


if __name__ == '__main__':
    unittest.main()
