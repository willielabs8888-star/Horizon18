# Coding Standards

- Python 3.11+ target (Windows friendly)
- Use type hints
- Prefer dataclasses for models
- Pure functions for calculations when possible
- No notebook-only logic: everything runnable via CLI
- Keep dependencies minimal (matplotlib only external dep for V0)
- UTF-8 encoding on all file writes (Windows compatibility)

Test runner:
- `python3 run_tests.py` (uses unittest, no pip dependencies needed)
- 96 engine tests + 9 API tests (105 total)

Web standards:
- React + Recharts via CDN (jsdelivr UMD bundles)
- Single-file frontend (index.html, no build step)
- Vanilla JS for quiz flow and API interactions

Lint/format:
- ruff
- black

Error handling:
- Fail loudly with helpful messages
