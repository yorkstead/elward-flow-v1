from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "brand" / "elward-logo-primary.png"
BRAND_BLUE = (27, 51, 79, 255)


def extract_orange_symbol() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    pixels = source.load()
    mask = Image.new("L", source.size, 0)
    mask_pixels = mask.load()

    for y in range(source.height):
        for x in range(source.width):
            red, green, blue, _ = pixels[x, y]
            if red > 190 and green < 145 and blue < 115:
                mask_pixels[x, y] = 255

    bounds = mask.getbbox()
    if bounds is None:
        raise RuntimeError("The orange Elward symbol was not found in the source logo.")

    symbol = source.crop(bounds)
    symbol.putalpha(mask.crop(bounds))
    return symbol


def fit_symbol(symbol: Image.Image, size: int, padding_ratio: float) -> Image.Image:
    available = round(size * (1 - padding_ratio * 2))
    scale = min(available / symbol.width, available / symbol.height)
    fitted = symbol.resize(
        (round(symbol.width * scale), round(symbol.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        fitted,
        ((size - fitted.width) // 2, (size - fitted.height) // 2),
    )
    return canvas


def app_icon(symbol: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BRAND_BLUE)
    fitted = fit_symbol(symbol, size, 0.14)
    canvas.alpha_composite(fitted)
    return canvas


def main() -> None:
    symbol = extract_orange_symbol()
    brand_dir = ROOT / "public" / "brand"
    app_dir = ROOT / "app"

    transparent_mark = fit_symbol(symbol, 512, 0.06)
    transparent_mark.save(brand_dir / "elward-symbol-orange.png", optimize=True)

    icon_192 = app_icon(symbol, 192)
    icon_512 = app_icon(symbol, 512)
    icon_192.save(brand_dir / "elward-app-icon-192.png", optimize=True)
    icon_512.save(brand_dir / "elward-app-icon-512.png", optimize=True)
    icon_512.save(app_dir / "icon.png", optimize=True)
    app_icon(symbol, 180).save(app_dir / "apple-icon.png", optimize=True)

    icon_512.save(
        app_dir / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
