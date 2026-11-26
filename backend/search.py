"""Busca de texto sem diferenciar acentos e maiúsculas (sem extensões no Postgres)."""
import unicodedata

from sqlalchemy import func

_ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ"
_PLAIN = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN"
assert len(_ACCENTED) == len(_PLAIN)


def normalize(text: str) -> str:
    """'  Lápis   AZUL ' -> 'lapis azul'"""
    no_accents = "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )
    return " ".join(no_accents.lower().split())


def sql_normalize(column):
    """Mesmo tratamento de normalize(), feito pelo banco."""
    return func.lower(func.translate(column, _ACCENTED, _PLAIN))
