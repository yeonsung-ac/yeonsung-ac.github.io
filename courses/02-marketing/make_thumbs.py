# -*- coding: utf-8 -*-
"""마케팅 교안 썸네일을 제목으로 그린다.  실행:  python make_thumbs.py

교안 표지를 그대로 쓰려고 뽑아 봤더니 열한 장이 모두 같은 '촉진관리' 띠라
목록에서 구분이 되지 않았다. 그래서 강의 영상 썸네일과 같은 손으로 그린다.

제목은 course.js 에서 읽는다. 목록이 두 군데 있으면 언젠가 어긋난다.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_class"))
from make_thumbs import W, H, LIME, NAVY, PAPER, BOLD, backdrop, wrap  # noqa: E402

from PIL import ImageDraw, ImageFont  # noqa: E402


def read_decks():
    src = (HERE / "course.js").read_text(encoding="utf-8")
    name = re.search(r'short:\s*"([^"]+)"', src).group(1)
    rows = re.findall(r'\{\s*t:\s*"([^"]+)",\s*d:\s*"([^"]+)",\s*p:\s*(\d+)\s*\}', src)
    return name, rows


def draw_one(i, title, date, pages, course):
    """_class 의 것과 결은 같되, 교안이라 담을 것이 다르다.
    영상은 '제n강'이면 충분하지만 교안은 언제 쓴 것인지가 함께 있어야 한다."""
    im = backdrop(i)
    d = ImageDraw.Draw(im)
    pad = 46

    d.text((pad, pad), course, font=ImageFont.truetype(BOLD, 21), fill=LIME)

    f_no = ImageFont.truetype(BOLD, 26)
    label = f"{i:02d}"
    tw = d.textlength(label, font=f_no)
    bx0, by0 = pad, pad + 44
    bx1, by1 = bx0 + tw + 34, by0 + 46
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=23, fill=LIME)
    d.text(((bx0 + bx1) / 2, (by0 + by1) / 2 + 1), label, font=f_no, fill=NAVY, anchor="mm")

    # 날짜와 쪽수는 번호 옆에. 열기 전에 분량을 가늠하게 한다.
    d.text((bx1 + 16, (by0 + by1) / 2 + 1), f"{date}  ·  {pages}쪽",
           font=ImageFont.truetype(BOLD, 19), fill=(150, 162, 180), anchor="lm")

    # 제목 - 폭에 맞춰 글자 크기를 줄여 가며 앉힌다. 긴 장 제목은 석 줄까지 본다.
    box_w = W - pad * 2
    for size in range(58, 22, -3):
        f = ImageFont.truetype(BOLD, size)
        lines = wrap(d, title, f, box_w)
        if len(lines) <= 3:
            break
    lh = int(size * 1.26)
    top = H - 58 - lh * len(lines) + int(size * 0.10)
    for k, line in enumerate(lines):
        d.text((pad, top + k * lh), line, font=f, fill=PAPER)

    d.rectangle((pad, H - 34, pad + 62, H - 29), fill=LIME)
    return im


def main():
    course, rows = read_decks()
    out = HERE / "thumbs"
    out.mkdir(exist_ok=True)
    for i, (t, date, pages) in enumerate(rows, 1):
        p = out / f"{i:02d}.jpg"
        draw_one(i, t, date, pages, course).save(
            p, "JPEG", quality=86, optimize=True, progressive=True)
        print(f"  {p.name}  {p.stat().st_size // 1024}KB  {t}")
    print(f"\n{len(rows)}장 만들었습니다 -> {out}")


if __name__ == "__main__":
    main()
