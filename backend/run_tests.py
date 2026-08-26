#!/usr/bin/env python3
"""Command line runner for the SoftPrompt reliability suite.

Usage:  python run_tests.py [--repeats N] [--json]
"""

from __future__ import annotations

import argparse
import json
import sys

from app import reliability


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the SoftPrompt reliability suite.")
    parser.add_argument("--repeats", type=int, default=1, help="how many times to run each case")
    parser.add_argument("--json", action="store_true", help="print raw JSON")
    args = parser.parse_args()

    result = reliability.run_suite(args.repeats)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        return 0 if result.failed == 0 else 1

    width = max(len(c["name"]) for c in result.cases) + 2
    for case in result.cases:
        status = "PASS" if case["passed"] else "FAIL"
        print(f"[{status}] {case['name']:<{width}} {case['detail']}")

    print("-" * 72)
    print(f"Total tests : {result.total}")
    print(f"Passed      : {result.passed}")
    print(f"Failed      : {result.failed}")
    print(f"Success rate: {result.success_rate}%")
    print(f"Duration    : {result.duration_ms} ms")
    return 0 if result.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
