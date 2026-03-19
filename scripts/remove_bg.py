import sys

from PIL import Image
from rembg import remove


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: remove_bg.py <input_path> <output_path>", file=sys.stderr)
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    input_img = Image.open(input_path)
    output_img = remove(input_img)
    output_img.save(output_path)
    print(f"Background removed and saved to {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
