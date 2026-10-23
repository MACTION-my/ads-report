from pathlib import Path
import tempfile
import unittest
from build_hub_entry import build


class HubEntryTest(unittest.TestCase):
    def test_disabled_and_valid_destination(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / 'event-hub') as folder:
            build(folder, False, '')
            path = Path(folder) / 'report' / 'index.html'
            self.assertIn('暂未开放', path.read_text(encoding='utf-8'))
            build(folder, True, 'https://script.google.com/macros/s/test-deployment/exec')
            self.assertIn('http-equiv="refresh"', path.read_text(encoding='utf-8'))
            for url in ['', 'https://evil.example/app', 'https://script.google.com.evil.example/macros/s/a/exec', 'https://script.google.com/macros/s/a/exec?token=secret']:
                with self.subTest(url=url), self.assertRaises(ValueError):
                    build(folder, True, url)


if __name__ == '__main__':
    unittest.main()
