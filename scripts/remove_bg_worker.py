import json
import sys

from PIL import Image
from rembg import new_session, remove


SESSION = new_session()


def process_one(line: str) -> None:
    try:
        payload = json.loads(line)
        input_path = payload["inputPath"]
        output_path = payload["outputPath"]

        with Image.open(input_path) as input_img:
            output_img = remove(input_img, session=SESSION)
            output_img.save(output_path)

        print(json.dumps({"ok": True}), flush=True)
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(error)}), flush=True)


for raw_line in sys.stdin:
    line = raw_line.strip()
    if not line:
        continue
    process_one(line)
