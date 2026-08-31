# -*- coding: utf-8 -*-
"""강의 썸네일을 제목으로 직접 그린다.

유튜브 썸네일은 강의 슬라이드라 제각각이고, 한 편은 아예 나오지 않았다.
열세 장이 한 벌로 보이려면 같은 손으로 그린 것이어야 한다.
사이트의 남색과 라임을 그대로 쓰고, 강 번호에 따라 무늬만 조금씩 달리한다.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"D:\01_CODEX\20260818_홈페이지작업\courses\01-management\thumbs")
W, H = 800, 450                       # 16:9
NAVY = (16, 27, 45)
LIME = (200, 239, 100)
PAPER = (247, 249, 245)

BOLD = r"C:\Windows\Fonts\malgunbd.ttf"
REG = r"C:\Windows\Fonts\malgun.ttf"

LECTURES = [
    "경영학이란?",
    "기업이란?",
    "시장이란 무엇인가?",
    "고객과 소비자에 대한 이해",
    "시장과 고객에 대한 접근",
    "동기부여와 리더십",
    "인적자원관리",
    "조직의 이해와 설계",
    "금융시스템과 증권시장",
    "회계와 재무의 이해",
    "경영 전략의 이해",
    "글로벌 경영",
    "기업윤리와 책임",
]


def wrap(draw, text, font, width):
    """글자 단위로 줄을 나눈다. 한글은 어절이 길어 단어 단위로는 잘 안 맞는다."""
    lines, cur = [], ""
    for ch in text:
        t = cur + ch
        if draw.textlength(t, font=font) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def backdrop(i):
    """강마다 조금씩 다른 결. 목록에서 눈으로 구분되되 한 벌로 보여야 한다.
    무늬가 제목을 가로지르면 읽기가 나빠지므로 글자가 앉는 아래쪽은 비워 둔다."""
    im = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(im, "RGBA")

    # 은은한 사선 결. 기울기와 간격을 강 번호로 바꾼다.
    tilt = 26 + (i % 4) * 9
    gap = 46 + (i % 3) * 14
    dx = math.tan(math.radians(tilt)) * H
    x = -abs(dx) - W
    while x < W * 2:
        d.polygon([(x, H), (x + dx, 0), (x + dx + gap * 0.5, 0), (x + gap * 0.5, H)],
                  fill=(255, 255, 255, 6))
        x += gap

    # 강 번호를 큰 숫자로 오른쪽 위에 깐다. 제목이 앉는 왼쪽 아래는 건드리지 않는다.
    big = ImageFont.truetype(BOLD, 210)
    n = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(n).text((W - 40, 8), str(i), font=big, fill=(255, 255, 255, 20), anchor="ra")
    im = Image.alpha_composite(im.convert("RGBA"), n).convert("RGB")

    # 위쪽에만 라임 실선 하나. 아래로 내려오지 않는다.
    d2 = ImageDraw.Draw(im, "RGBA")
    y = int(H * (0.11 + (i % 4) * 0.045))
    d2.polygon([(0, y), (W, y - int(H * 0.055)), (W, y - int(H * 0.055) + 5), (0, y + 5)],
               fill=LIME + (46,))
    return im


def draw_one(i, title):
    im = backdrop(i)
    d = ImageDraw.Draw(im)

    pad = 46
    # 머리 - 과목 이름
    f_eyebrow = ImageFont.truetype(BOLD, 21)
    d.text((pad, pad), "경영학원론", font=f_eyebrow, fill=LIME)

    # 강 번호 - 알약 모양
    f_no = ImageFont.truetype(BOLD, 26)
    label = f"제{i}강"
    tw = d.textlength(label, font=f_no)
    bx0, by0 = pad, pad + 44
    bx1, by1 = bx0 + tw + 34, by0 + 46
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=23, fill=LIME)
    d.text(((bx0 + bx1) / 2, (by0 + by1) / 2 + 1), label, font=f_no, fill=NAVY, anchor="mm")

    # 제목 - 폭에 맞춰 글자 크기를 줄여 가며 앉힌다
    box_w = W - pad * 2
    for size in range(64, 29, -3):
        f = ImageFont.truetype(BOLD, size)
        lines = wrap(d, title, f, box_w)
        if len(lines) <= 2:
            break
    lh = int(size * 1.28)
    top = H - 58 - lh * len(lines) + int(size * 0.10)
    for k, line in enumerate(lines):
        d.text((pad, top + k * lh), line, font=f, fill=PAPER)

    # 아래 왼쪽 라임 밑줄
    d.rectangle((pad, H - 34, pad + 62, H - 29), fill=LIME)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, title in enumerate(LECTURES, 1):
        im = draw_one(i, title)
        p = OUT / f"{i:02d}.jpg"
        im.save(p, "JPEG", quality=86, optimize=True, progressive=True)
        print(f"  {p.name}  {p.stat().st_size // 1024}KB  {title}")
    print(f"\n{len(LECTURES)}장 만들었습니다 -> {OUT}")


if __name__ == "__main__":
    main()
