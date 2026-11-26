import re


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def is_valid_cpf(cpf: str) -> bool:
    """Confere os dois dígitos verificadores. Recebe só dígitos."""
    if len(cpf) != 11 or not cpf.isdigit() or cpf == cpf[0] * 11:
        return False
    for size in (9, 10):
        total = sum(int(cpf[i]) * (size + 1 - i) for i in range(size))
        check = (total * 10) % 11 % 10
        if check != int(cpf[size]):
            return False
    return True
