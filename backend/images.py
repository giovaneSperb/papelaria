MAX_IMAGE_BYTES = 2 * 1024 * 1024


def detect_mime(data: bytes) -> str | None:
    """Confere o tipo pelo conteúdo do arquivo, não pelo nome."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
