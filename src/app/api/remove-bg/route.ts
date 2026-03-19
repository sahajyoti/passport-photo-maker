import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { removeBackground } from "@imgly/background-removal";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function runPythonRemoveBg(pythonBin: string, scriptPath: string, inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `remove_bg.py exited with code ${code}`));
    });
  });
}

export async function POST(request: Request) {
  let tempDir = "";
  let imageBuffer: Buffer | null = null;
  let imageArrayBuffer: ArrayBuffer | null = null;

  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    tempDir = await mkdtemp(join(tmpdir(), "rembg-"));
    const inputPath = join(tempDir, image.name || "input.jpg");
    const outputPath = join(tempDir, "output.png");
    const scriptPath = join(process.cwd(), "scripts", "remove_bg.py");
    const pythonBin = process.env.REMBG_PYTHON_BIN || "python3";

    imageArrayBuffer = await image.arrayBuffer();
    imageBuffer = Buffer.from(imageArrayBuffer);
    await writeFile(inputPath, imageBuffer);

    try {
      await runPythonRemoveBg(pythonBin, scriptPath, inputPath, outputPath);
      const outputBuffer = await readFile(outputPath);

      return new NextResponse(outputBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "x-remove-bg-engine": "python-rembg",
        },
      });
    } catch {
      if (!imageArrayBuffer) {
        throw new Error("Invalid image data.");
      }

      const inputBlob = new Blob([imageArrayBuffer], {
        type: image.type || "image/jpeg",
      });
      const outputBlob = await removeBackground(inputBlob);
      const outputBuffer = Buffer.from(await outputBlob.arrayBuffer());

      return new NextResponse(outputBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "x-remove-bg-engine": "imgly-fallback",
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Background removal failed: ${message}` },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
