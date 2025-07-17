import re

link_regex = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
tag_regex = re.compile(r"<.*?>")


def sanitize_input(text: str) -> str:
    text = link_regex.sub("", text)
    text = tag_regex.sub("", text)
    return text.strip()
