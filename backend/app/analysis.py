"""Statistical image analysis helpers.

Everything in here is an *indicator* only. A clean report never proves an image
is free of hidden data, and a suspicious report never proves it carries any.
"""

from __future__ import annotations

import hashlib
import math

import numpy as np
from PIL import Image

from . import stego


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def shannon_entropy(values: np.ndarray) -> float:
    counts = np.bincount(values.reshape(-1), minlength=256).astype(np.float64)
    total = counts.sum()
    if total == 0:
        return 0.0
    probs = counts[counts > 0] / total
    return float(-(probs * np.log2(probs)).sum())


def analyze(image: Image.Image, raw: bytes, filename: str) -> dict:
    rgb = np.array(image.convert("RGB"))
    width, height = image.size
    channels = {"r": rgb[:, :, 0], "g": rgb[:, :, 1], "b": rgb[:, :, 2]}

    rgb_stats = {
        name: {
            "mean": round(float(chan.mean()), 3),
            "std": round(float(chan.std()), 3),
            "min": int(chan.min()),
            "max": int(chan.max()),
            "entropy": round(shannon_entropy(chan), 4),
        }
        for name, chan in channels.items()
    }

    lsb = rgb & 1
    lsb_ones = int(lsb.sum())
    lsb_total = int(lsb.size)
    lsb_ratio = lsb_ones / lsb_total if lsb_total else 0.0
    lsb_per_channel = {
        name: round(float((chan & 1).mean()), 4) for name, chan in channels.items()
    }

    # Chi-square style deviation of the LSB plane from a perfect 50/50 split.
    expected = lsb_total / 2
    chi_square = ((lsb_ones - expected) ** 2 / expected) + (
        ((lsb_total - lsb_ones) - expected) ** 2 / expected
    ) if lsb_total else 0.0

    scan = stego.extract(image)

    if scan.detected and scan.integrity_ok:
        verdict = "SoftPrompt payload present"
    elif scan.detected:
        verdict = "SoftPrompt header present but payload is damaged"
    elif abs(lsb_ratio - 0.5) < 0.01:
        verdict = "LSB plane looks close to random - possible embedding, not conclusive"
    else:
        verdict = "No SoftPrompt payload found; LSB plane shows no strong anomaly"

    return {
        "file": {
            "filename": filename,
            "format": image.format or "unknown",
            "mode": image.mode,
            "size_bytes": len(raw),
            "sha256": sha256_hex(raw),
            "lossless": (image.format or "").upper() in stego.LOSSLESS_FORMATS,
        },
        "dimensions": {
            "width": width,
            "height": height,
            "pixels": width * height,
            "capacity_bytes": stego.capacity_bytes(width, height),
            "usable_text_bytes": max(
                0, stego.capacity_bytes(width, height) - stego.HEADER_SIZE
            ),
        },
        "rgb_stats": rgb_stats,
        "overall_entropy": round(shannon_entropy(rgb), 4),
        "lsb": {
            "ones": lsb_ones,
            "zeros": lsb_total - lsb_ones,
            "total": lsb_total,
            "ratio_ones": round(lsb_ratio, 6),
            "per_channel_ratio": lsb_per_channel,
            "chi_square": round(float(chi_square), 3),
        },
        "payload": scan.to_dict(),
        "verdict": verdict,
        "disclaimer": (
            "Statistical analysis is only an indicator. A near-random LSB plane can "
            "occur in ordinary noisy photographs, and a careful embedding can look "
            "perfectly normal. These numbers can never guarantee an image is clean."
        ),
    }


def entropy_of_bytes(data: bytes) -> float:
    if not data:
        return 0.0
    return shannon_entropy(np.frombuffer(data, dtype=np.uint8))


def bit_error_rate(a: str, b: str) -> float:
    """Fraction of differing characters, used by the reliability report."""
    if a == b:
        return 0.0
    if not a and not b:
        return 0.0
    longest = max(len(a), len(b))
    diff = sum(1 for x, y in zip(a, b) if x != y) + abs(len(a) - len(b))
    return diff / longest


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    return float(np.percentile(np.array(values), pct))


def psnr(original: Image.Image, modified: Image.Image) -> float:
    a = np.array(original.convert("RGB"), dtype=np.float64)
    b = np.array(modified.convert("RGB"), dtype=np.float64)
    if a.shape != b.shape:
        return 0.0
    mse = float(((a - b) ** 2).mean())
    if mse == 0:
        return math.inf
    return 10 * math.log10((255.0**2) / mse)
