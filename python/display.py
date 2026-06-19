#!/usr/bin/env python3
# Thin display shim: PNG -> 1-bit -> Waveshare 10.85" panel.
# Usage: python3 display.py <png_path> [--full] [--dither]
import sys
import os
import time
from PIL import Image

BASE_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(BASE_DIR, 'lib'))
from waveshare_epd import epd10in85


def main():
    if len(sys.argv) < 2:
        print('usage: display.py <png_path> [--full] [--dither]', file=sys.stderr)
        sys.exit(2)
    png_path = sys.argv[1]
    flags = sys.argv[2:]
    full = '--full' in flags
    # Dashboard text wants crisp thresholding (NONE); photos look better dithered.
    dither = Image.Dither.FLOYDSTEINBERG if '--dither' in flags else Image.Dither.NONE

    img = Image.open(png_path).convert('1', dither=dither)

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
