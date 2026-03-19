import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_BIN_CANDIDATES = [
  process.env.REMBG_PYTHON_BIN,
  "python3",
  "python",
].filter((value): value is string => Boolean(value));

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "remove_bg.py");

function runPythonScript(pythonBin: string, inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [SCRIPT_PATH, inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer | string) => {
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

      reject(new Error(stderr.trim() || `Python process exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await image.arrayBuffer());
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "remove-bg-"));
    const inputPath = path.join(workDir, "input.png");
    const outputPath = path.join(workDir, "output.png");

    let outputBuffer: Buffer | null = null;
    let lastError: Error | null = null;

    try {
      await fs.writeFile(inputPath, inputBuffer);

      for (const pythonBin of PYTHON_BIN_CANDIDATES) {
        try {
          await runPythonScript(pythonBin, inputPath, outputPath);
          outputBuffer = await fs.readFile(outputPath);
          lastError = null;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }

    if (!outputBuffer) {
      throw new Error(lastError?.message || "Python background removal failed.");
    }

    const outputBytes = new Uint8Array(outputBuffer.byteLength);
    outputBytes.set(outputBuffer);
    const outputBlob = new Blob([outputBytes], { type: "image/png" });

    return new NextResponse(outputBlob, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "x-remove-bg-engine": "python-rembg",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Background removal failed: ${message}` },
      { status: 500 },
    );
  }
}
