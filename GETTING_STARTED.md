# Getting Started — Horizon18

A step-by-step guide to running this project on your own computer. No prior Python experience needed.

---

## Step 1: Install Python

You need Python 3.8 or newer. Here's how to check if you already have it:

**Mac:**
Open the **Terminal** app (search for "Terminal" in Spotlight) and type:
```
python3 --version
```
If you see something like `Python 3.10.12`, you're good. If not, go to [python.org/downloads](https://www.python.org/downloads/) and download the latest version. Run the installer with all the default options.

**Windows:**
Open **Command Prompt** (search for "cmd" in the Start menu) and type:
```
python --version
```
If it's not installed, go to [python.org/downloads](https://www.python.org/downloads/) and download the latest version. **Important:** during installation, check the box that says **"Add Python to PATH"** — this is easy to miss and will cause headaches later if you skip it.

After installing, close and reopen your terminal/command prompt, then verify:
```
python3 --version     # Mac/Linux
python --version      # Windows
```

---

## Step 2: Download the Project

If you have the project folder already (from Cowork, a USB drive, etc.), just know where it is on your computer.

If you're pulling from GitHub:
```
git clone <repo-url>
cd horizon18
```

---

## Step 3: Install the One Dependency

The CLI chart output needs one external library: **matplotlib** (for generating PNG charts). The web app needs nothing extra.

Open your terminal, navigate to the project folder, and run:

**Mac/Linux:**
```
pip3 install matplotlib
```

**Windows:**
```
pip install matplotlib
```

If `pip` doesn't work, try `python3 -m pip install matplotlib` (Mac) or `python -m pip install matplotlib` (Windows).

That's it — no other libraries needed. The web app uses zero external dependencies.

---

## Step 4: Run the Web App (Recommended)

The web app gives you interactive charts with hover tooltips, a guided quiz, and a timeline slider — all in your browser.

**Start the server:**
```
python backend/main.py       # Windows
python3 backend/main.py      # Mac/Linux
```

**Open in your browser:**
```
http://localhost:8000
```

You'll see:
1. A **guided quiz** that walks you through path selection and configuration
2. **Multi-instance comparison** — add the same path type multiple times with different options
3. **7 interactive charts** with hover tooltips showing data at every age
4. A **timeline slider** (10-50 years) — drag it and watch all charts update live
5. **Summary cards** ranking paths by final net worth
6. **Key insights** explaining what the numbers mean

No extra dependencies needed — the web app uses only Python's built-in `http.server`.

---

## Step 5: Run the CLI Demo (Optional)

The demo mode runs a preset 5-path comparison so you can see CLI output.

**Mac/Linux:**
```
python3 cli.py demo
```

**Windows:**
```
python cli.py demo
```

You can set the projection horizon (default: 32 years, range: 10-50):
```
python cli.py demo --years 20
python cli.py demo --years 42
```

---

## Step 6: Run the Interactive CLI Quiz (Optional)

```
python3 cli.py quiz                # Mac/Linux
python cli.py quiz                 # Windows
python cli.py quiz --years 40      # Custom horizon
```

---

## Step 7: Run the Tests (Optional)

```
python3 run_tests.py              # 96 engine tests
python3 backend/test_api.py       # 9 API tests
```

---

## Troubleshooting

**"python3: command not found"**
On Windows, try just `python` instead of `python3`. On Mac, you need to install Python from python.org.

**"No module named matplotlib"**
You need to install it: `pip3 install matplotlib`. The web app does NOT need matplotlib — only the CLI chart output does.

**"No module named defaults" or similar import error**
Make sure you're running the command from inside the project folder, not from a parent or child folder.

**Charts aren't showing up (CLI)**
They're saved as files, not displayed in a window. Look in `outputs/runs/<timestamp>/` for the PNG files.

---

## Project Structure

```
horizon18/
├── backend/
│   ├── main.py            ← Web server (python backend/main.py)
│   ├── api.py             ← JSON API logic (POST /api/simulate)
│   └── test_api.py        ← API tests (9 tests)
├── frontend/
│   └── index.html         ← React app (quiz + charts + slider)
├── cli.py                 ← CLI entry point for demo + quiz
├── run_tests.py           ← Runs all 96 engine tests
├── compare.py             ← Orchestrates multi-path comparisons
├── model/
│   ├── data_models.py     ← All data types (PathType, Scenario, etc.)
│   ├── loan.py            ← Loan amortization math
│   ├── projection.py      ← Year-by-year simulation engine
│   └── metrics.py         ← Adaptive milestone summary stats
├── engines/
│   ├── education.py       ← Education Cost Engine
│   ├── career.py          ← Career Income Engine
│   └── living.py          ← Living Expense Engine
├── defaults/              ← All financial data (tuition, salaries, etc.)
├── builder/
│   └── builder.py         ← Turns quiz answers into Scenarios
├── outputs/
│   ├── charts.py          ← CLI chart generation (matplotlib)
│   ├── tables.py          ← Terminal tables + CSV export
│   └── narrative.py       ← Plain-English summary
├── tests/                 ← All test files (96 tests)
└── docs/                  ← Architecture + product docs
```
