"""Core LSB steganography engine for SoftPrompt.

Payload layout embedded in the least significant bits of the RGB channels:

    magic      4 bytes   b"SPR1"
    version    1 byte    currently 1
    flags      1 byte    bit0 -> body is AES-256-GCM encrypted
    body_len   4 bytes   big endian length of the body
    digest    32 bytes   SHA-256 of the body exactly as embedded
    body       N bytes   UTF-8 text, or salt|nonce|ciphertext when encrypted

Bits are written most-significant-bit first, scanning the image row by row and
inside each pixel in R, G, B order. The alpha channel is never touched so an
RGBA image keeps its transparency untouched.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from PIL import Image

MAGIC = b"SPR1"
VERSION = 1
FLAG_ENCRYPTED = 0b0000_0001
HEADER_SIZE = 4 + 1 + 1 + 4 + 32  # 42 bytes

SALT_SIZE = 16
NONCE_SIZE = 12
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1

LOSSLESS_FORMATS = {"PNG", "BMP", "TIFF", "WEBP"}


class StegoError(Exception):
    """Raised for any recoverable encode/decode problem."""


@dataclass
class ScanResult:
    detected: bool
    reason: str
    encrypted: bool = False
    integrity_ok: bool = False
    version: Optional[int] = None
    encoding_method: Optional[str] = None
    payload_bytes: Optional[int] = None
    text: Optional[str] = None
    body_sha256: Optional[str] = None
    expected_sha256: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = Scrypt(salt=salt, length=32, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return kdf.derive(password.encode("utf-8"))


def encrypt_body(plaintext: bytes, password: str) -> bytes:
    salt = os.urandom(SALT_SIZE)
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(_derive_key(password, salt)).encrypt(nonce, plaintext, None)
    return salt + nonce + ciphertext


def decrypt_body(body: bytes, password: str) -> bytes:
    if len(body) <= SALT_SIZE + NONCE_SIZE:
        raise StegoError("Encrypted body is truncated.")
    salt = body[:SALT_SIZE]
    nonce = body[SALT_SIZE : SALT_SIZE + NONCE_SIZE]
    ciphertext = body[SALT_SIZE + NONCE_SIZE :]
    try:
        return AESGCM(_derive_key(password, salt)).decrypt(nonce, ciphertext, None)
    except Exception as exc:  # cryptography raises InvalidTag
        raise StegoError("Wrong password or corrupted encrypted payload.") from exc


def build_packet(text: str, password: Optional[str] = None) -> bytes:
    body = text.encode("utf-8")
    flags = 0
    if password:
        body = encrypt_body(body, password)
        flags |= FLAG_ENCRYPTED
    digest = hashlib.sha256(body).digest()
    return (
        MAGIC
        + bytes([VERSION, flags])
        + len(body).to_bytes(4, "big")
        + digest
        + body
    )


def capacity_bytes(width: int, height: int) -> int:
    """Total bytes (header included) that fit in one LSB per RGB channel."""
    return (width * height * 3) // 8


def _to_rgb_array(image: Image.Image) -> tuple[np.ndarray, Optional[np.ndarray]]:
    alpha = None
    if image.mode in ("RGBA", "LA", "PA"):
        rgba = image.convert("RGBA")
        alpha = np.array(rgba)[:, :, 3]
        rgb = np.array(rgba)[:, :, :3]
    else:
        rgb = np.array(image.convert("RGB"))
    return rgb, alpha


def embed(image: Image.Image, packet: bytes) -> Image.Image:
    rgb, alpha = _to_rgb_array(image)
    height, width = rgb.shape[0], rgb.shape[1]
    flat = rgb.reshape(-1).copy()

    bits = np.unpackbits(np.frombuffer(packet, dtype=np.uint8))
    if bits.size > flat.size:
        raise StegoError(
            f"Payload needs {bits.size // 8} bytes but the image only holds "
            f"{capacity_bytes(width, height)} bytes."
        )

    flat[: bits.size] = (flat[: bits.size] & 0xFE) | bits
    out = flat.reshape(rgb.shape)

    if alpha is not None:
        out = np.dstack([out, alpha])
        return Image.fromarray(out.astype(np.uint8), mode="RGBA")
    return Image.fromarray(out.astype(np.uint8), mode="RGB")


def _read_bytes(flat: np.ndarray, start_bit: int, count: int) -> bytes:
    end_bit = start_bit + count * 8
    if end_bit > flat.size:
        raise StegoError("Image is too small to contain the announced payload.")
    bits = (flat[start_bit:end_bit] & 1).astype(np.uint8)
    return np.packbits(bits).tobytes()


def extract(image: Image.Image, password: Optional[str] = None) -> ScanResult:
    rgb, _ = _to_rgb_array(image)
    flat = rgb.reshape(-1)

    if flat.size < HEADER_SIZE * 8:
        return ScanResult(detected=False, reason="Image is smaller than a SoftPrompt header.")

    header = _read_bytes(flat, 0, HEADER_SIZE)
    if header[:4] != MAGIC:
        return ScanResult(detected=False, reason="No valid hidden payload detected.")

    version = header[4]
    flags = header[5]
    body_len = int.from_bytes(header[6:10], "big")
    expected = header[10:42]
    encrypted = bool(flags & FLAG_ENCRYPTED)
    method = "LSB (1 bit/channel, RGB)" + (" + AES-256-GCM" if encrypted else "")

    if version != VERSION:
        return ScanResult(
            detected=True,
            reason=f"Unsupported SoftPrompt version {version}.",
            encrypted=encrypted,
            version=version,
            encoding_method=method,
        )

    max_body = capacity_bytes(rgb.shape[1], rgb.shape[0]) - HEADER_SIZE
    if body_len <= 0 or body_len > max_body:
        return ScanResult(
            detected=True,
            reason="Header found but the declared payload length is invalid.",
            encrypted=encrypted,
            version=version,
            encoding_method=method,
            payload_bytes=body_len,
        )

    body = _read_bytes(flat, HEADER_SIZE * 8, body_len)
    actual = hashlib.sha256(body).hexdigest()
    integrity_ok = actual == expected.hex()

    result = ScanResult(
        detected=True,
        reason="SoftPrompt payload detected.",
        encrypted=encrypted,
        integrity_ok=integrity_ok,
        version=version,
        encoding_method=method,
        payload_bytes=body_len,
        body_sha256=actual,
        expected_sha256=expected.hex(),
    )
    if not integrity_ok:
        result.reason = "Payload found but the checksum does not match (data corrupted)."
        return result

    if encrypted:
        if not password:
            result.reason = "Encrypted payload detected. Provide the password to decrypt it."
            return result
        try:
            result.text = decrypt_body(body, password).decode("utf-8", errors="replace")
        except StegoError as exc:
            result.reason = str(exc)
            return result
        result.reason = "Encrypted SoftPrompt payload decrypted successfully."
        return result

    try:
        result.text = body.decode("utf-8")
    except UnicodeDecodeError:
        result.text = body.decode("utf-8", errors="replace")
        result.reason = "Payload decoded with replacement characters (invalid UTF-8)."
    return result
