#!/usr/bin/env python3
# Thin display shim: PNG -> 1-bit -> Waveshare 10.85" panel.
# Usage: python3 display.py <png_path> [--full]
import sys
import os
import time
from PIL import Image

BASE_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(BASE_DIR, 'lib'))
from waveshare_epd import epd10in85


def main():
    if len(sys.argv) < 2:
        print('usage: display.py <png_path> [--full]', file=sys.stderr)
        sys.exit(2)
    png_path = sys.argv[1]
    full = '--full' in sys.argv[2:]

    img = Image.open(png_path).convert('1', dither=Image.Dither.NONE)

    epd = epd10in85.EPD()
    if full:
        epd.init()
        epd.Clear()
        time.sleep(1)
        epd.display(epd.getbuffer(img))
        time.sleep(2)
    else:
        epd.init_Part()
        epd.display_Partial(epd.getbuffer(img), 0, 0, epd.width, epd.height)


if __name__ == '__main__':
    main()
