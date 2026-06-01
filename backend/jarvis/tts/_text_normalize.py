"""Препроцессинг текста перед XTTS-синтезом на русском.

XTTS не умеет читать цифры, единицы измерения и спецсимволы напрямую — он
буквально транслитерирует "22" как "цифра-два-два", и иногда коверкает
топонимы ("Бишкек" → "Бищкэк"). Здесь мы:

  1. Заменяем цифры и числа на слова через num2words(lang="ru").
  2. Раскрываем единицы (°C, %, км/ч и т.п.).
  3. Чистим markdown/служебные символы и эмодзи.

Обработка консервативная: если непонятно как раскрыть — оставляем как есть,
чтобы не сломать смысл.
"""

from __future__ import annotations

import re
import unicodedata

from num2words import num2words

# Замены единиц измерения и символов.
# Ключ — regex (case-insensitive), значение — что вставить вместо.
_UNIT_REPLACEMENTS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"°\s*[CС]"), " градусов"),
    (re.compile(r"°\s*[FФ]"), " градусов фаренгейта"),
    (re.compile(r"°"), " градусов"),
    (re.compile(r"%"), " процентов"),
    (re.compile(r"\bкм/ч\b", re.IGNORECASE), " километров в час"),
    (re.compile(r"\bм/с\b", re.IGNORECASE), " метров в секунду"),
    (re.compile(r"\bкг\b", re.IGNORECASE), " килограмм"),
    (re.compile(r"\bмм\b", re.IGNORECASE), " миллиметров"),
    (re.compile(r"\bсм\b", re.IGNORECASE), " сантиметров"),
    (re.compile(r"\bкм\b", re.IGNORECASE), " километров"),
    # «30 мин», «30 мин.» (только сразу после числа) → «30 минут».
    # Не трогаем уже написанные «минут», «минута» и т.п.
    (re.compile(r"(?<=\d)\s*мин\.?(?=\W|$)", re.IGNORECASE), " минут"),
    (re.compile(r"(?<=\d)\s*сек\.?(?=\W|$)", re.IGNORECASE), " секунд"),
    (re.compile(r"(?<=\d)\s*ч\.?(?=\W|$)", re.IGNORECASE), " часов"),
    (re.compile(r"₽"), " рублей"),
    (re.compile(r"\$"), " долларов"),
    (re.compile(r"€"), " евро"),
]

# Markdown-символы и эмодзи срезаем.
_STRIP_CHARS = re.compile(r"[*_`#>~]")


def _number_to_words_ru(num_str: str) -> str:
    """Перевести строковое число в русские слова. Для отрицательных и дробных тоже работает."""
    try:
        # Запятая как десятичный разделитель — поддержим оба варианта.
        cleaned = num_str.replace(",", ".")
        if "." in cleaned:
            value: float = float(cleaned)
        else:
            value = int(cleaned)
        return num2words(value, lang="ru")
    except (ValueError, NotImplementedError):
        return num_str


_NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")
# Время вида 18:45 → 'восемнадцать сорок пять'. Делается ДО _NUMBER_RE.
_TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")


def _replace_time(text: str) -> str:
    def _sub(m: re.Match) -> str:
        h = _number_to_words_ru(m.group(1))
        mm = _number_to_words_ru(m.group(2))
        return f"{h} {mm}"

    return _TIME_RE.sub(_sub, text)


def _replace_numbers(text: str) -> str:
    """Все числа в тексте → слова. '22°C' остаётся '22°C' до этого шага,
    но _UNIT_REPLACEMENTS сначала превратит °C в ' градусов', потом мы заменим '22'.
    """
    return _NUMBER_RE.sub(lambda m: _number_to_words_ru(m.group(0)), text)


def _strip_emojis(text: str) -> str:
    """Убрать эмодзи и прочие не-печатные символы (категории So, Sk, Cn)."""
    return "".join(ch for ch in text if unicodedata.category(ch) not in {"So", "Sk", "Cn"})


def normalize_for_tts(text: str) -> str:
    """Подготовить текст к XTTS-синтезу на русском.

    Порядок важен:
      1. Раскрываем единицы (чтобы '22°C' стало '22 градусов').
         Делаем ДО эмодзи-стриппера, иначе он съест '°' (категория Unicode So).
      2. Срезаем markdown и эмодзи.
      3. Конвертируем все числа в слова ('22' → 'двадцать два').
      4. Сжимаем пробелы.
    """
    if not text:
        return ""

    out = text.strip()

    for pattern, replacement in _UNIT_REPLACEMENTS:
        out = pattern.sub(replacement, out)

    out = _strip_emojis(out)
    out = _STRIP_CHARS.sub("", out)

    out = _replace_time(out)
    out = _replace_numbers(out)

    # Сжать множественные пробелы и нормализовать пробелы вокруг знаков препинания.
    out = re.sub(r"\s+", " ", out).strip()
    return out


# Делитель предложений: режем по . ! ? и крупным паузам (точка с запятой, тире).
# Используется для streaming-синтеза в XTTS — короткие куски синтезируются
# быстрее и можно начать проигрывание первого, пока остальные ещё в работе.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[А-ЯA-Zа-яa-z])")


def split_into_sentences(text: str) -> list[str]:
    """Разрезать текст на предложения. Возвращает список без пустых.

    Используется для streaming-синтеза: каждое предложение синтезируется
    отдельно, первый кусок начинает играть пока остальные ещё в работе.
    """
    if not text:
        return []
    parts = _SENTENCE_SPLIT_RE.split(text.strip())
    return [p.strip() for p in parts if p.strip()]
