import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import reliability, stego
from app.main import app

client = TestClient(app)


def make_image(width=128, height=128, mode="RGB"):
    rng = np.random.default_rng(7)
    arr = rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)
    img = Image.fromarray(arr, mode="RGB")
    return img.convert(mode)


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_roundtrip_plain():
    img = make_image()
    packet = stego.build_packet("hello hidden world")
    result = stego.extract(stego.embed(img, packet))
    assert result.detected and result.integrity_ok
    assert result.text == "hello hidden world"


def test_roundtrip_encrypted():
    img = make_image()
    packet = stego.build_packet("secret", password="pw")
    encoded = stego.embed(img, packet)
    assert stego.extract(encoded).text is None  # no password -> no plaintext
    assert stego.extract(encoded, "pw").text == "secret"
    assert stego.extract(encoded, "nope").text is None


def test_clean_image_not_detected():
    assert stego.extract(make_image()).detected is False


def test_capacity_guard():
    with pytest.raises(stego.StegoError):
        stego.embed(make_image(16, 16), stego.build_packet("x" * 5000))


def test_alpha_channel_preserved():
    img = make_image(mode="RGBA")
    encoded = stego.embed(img, stego.build_packet("alpha"))
    assert encoded.mode == "RGBA"
    assert np.array_equal(np.array(img)[:, :, 3], np.array(encoded)[:, :, 3])


def test_api_encode_scan_roundtrip():
    data = png_bytes(make_image(200, 200))
    enc = client.post(
        "/api/encode",
        files={"image": ("in.png", data, "image/png")},
        data={"message": "api level prompt", "output_format": "PNG"},
    )
    assert enc.status_code == 200
    payload = enc.json()
    import base64

    encoded_bytes = base64.b64decode(payload["encoded"]["data_url"].split(",", 1)[1])
    scan = client.post("/api/scan", files={"image": ("out.png", encoded_bytes, "image/png")})
    assert scan.status_code == 200
    detection = scan.json()["detection"]
    assert detection["detected"] and detection["integrity_ok"]
    assert detection["text"] == "api level prompt"


def test_api_analyze():
    res = client.post(
        "/api/analyze", files={"image": ("a.png", png_bytes(make_image()), "image/png")}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["dimensions"]["capacity_bytes"] > 0
    assert "disclaimer" in body


def test_reliability_suite_all_pass():
    result = reliability.run_suite()
    assert result.total >= 20
    assert result.success_rate >= 90.0
