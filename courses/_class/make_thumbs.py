# -*- coding: utf-8 -*-
"""강의 썸네일을 제목으로 그린다.  실행:  python make_thumbs.py 04-consumer-behavior

유튜브 썸네일은 강의 슬라이드를 캡처한 것이라 편마다 제각각이고, 아직 영상을
올리지 않은 강은 그림 자체가 없다. 열몇 장이 한 벌로 보이려면 같은 손으로
그린 것이어야 한다.

제목은 그 과목의 course.js 에서 읽는다. 목록이 두 군데 있으면 언젠가
어긋나므로, 화면이 쓰는 그 파일을 그대로 본다.
"""
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
W, H = 800, 450                       # 16:9
NAVY = (16, 27, 45)
LIME = (200, 239, 100)
PAPER = (247, 249, 245)
BOLD = r"C:\Windows\Fonts\malgunbd.ttf"


def read_course(folder: Path):
    """course.js 에서 과목 이름과 강의 제목을 뽑는다."""
    src = (folder / "course.js").read_text(encoding="utf-8")
    name = re.search(r'name:\s*"([^"]+)"', src).group(1)
    titles = re.findall(r'\bt:\s*"([^"]*)"', src)   # 아직 제목이 없는 강도 자리를 잡는다
    return name, titles


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

    tilt = 26 + (i % 4) * 9
    gap = 46 + (i % 3) * 14
    dx = math.tan(math.radians(tilt)) * H
    x = -abs(dx) - W
    while x < W * 2:
        d.polygon([(x, H), (x + dx, 0), (x + dx + gap * 0.5, 0), (x + gap * 0.5, H)],
                  fill=(255, 255, 255, 6))
        x += gap

    # 강 번호를 큰 숫자로 오른쪽 위에. 제목이 앉는 왼쪽 아래는 건드리지 않는다.
    n = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(n).text((W - 40, 8), str(i), font=ImageFont.truetype(BOLD, 210),
                           fill=(255, 255, 255, 20), anchor="ra")
    im = Image.alpha_composite(im.convert("RGBA"), n).convert("RGB")

    d2 = ImageDraw.Draw(im, "RGBA")
    y = int(H * (0.11 + (i % 4) * 0.045))
    d2.polygon([(0, y), (W, y - int(H * 0.055)), (W, y - int(H * 0.055) + 5), (0, y + 5)],
               fill=LIME + (46,))
    return im


def draw_one(i, title, course, unit):
    im = backdrop(i)
    d = ImageDraw.Draw(im)
    pad = 46

    d.text((pad, pad), course, font=ImageFont.truetype(BOLD, 21), fill=LIME)
    soon = not title.strip()
    if soon:
        title = "준비 중"

    f_no = ImageFont.truetype(BOLD, 26)
    label = f"제{i}{unit}"
    tw = d.textlength(label, font=f_no)
    bx0, by0 = pad, pad + 44
    bx1, by1 = bx0 + tw + 34, by0 + 46
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=23, fill=LIME)
    d.text(((bx0 + bx1) / 2, (by0 + by1) / 2 + 1), label, font=f_no, fill=NAVY, anchor="mm")

    # 제목 - 폭에 맞춰 글자 크기를 줄여 가며 앉힌다
    box_w = W - pad * 2
    for size in range(64, 25, -3):
        f = ImageFont.truetype(BOLD, size)
        lines = wrap(d, title, f, box_w)
        if len(lines) <= 2:
            break
    lh = int(size * 1.28)
    top = H - 58 - lh * len(lines) + int(size * 0.10)
    for k, line in enumerate(lines):
        d.text((pad, top + k * lh), line, font=f, fill=(120, 132, 150) if soon else PAPER)

    d.rectangle((pad, H - 34, pad + 62, H - 29), fill=LIME)
    return im


def main():
    if len(sys.argv) < 2:
        sys.exit("어느 과목인지 적어 주세요.  예)  python make_thumbs.py 04-consumer-behavior")
    folder = HERE.parent / sys.argv[1]
    unit = sys.argv[2] if len(sys.argv) > 2 else "강"
    name, titles = read_course(folder)
    out = folder / "thumbs"
    out.mkdir(exist_ok=True)

    for i, title in enumerate(titles, 1):
        p = out / f"{i:02d}.jpg"
        draw_one(i, title, name, unit).save(p, "JPEG", quality=86, optimize=True, progressive=True)
        print(f"  {p.name}  {p.stat().st_size // 1024}KB  {title}")
    print(f"\n{name} · {len(titles)}장 만들었습니다 -> {out}")


if __name__ == "__main__":
    main()
