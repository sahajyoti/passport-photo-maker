import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { readFile, rm, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PendingTask = {
  resolve: () => void;
  reject: (error: Error) => void;
};

let worker: ChildProcessWithoutNullStreams | null = null;
let workerReader: Interface | null = null;
let pendingTasks: PendingTask[] = [];
let workerQueue: Promise<void> = Promise.resolve();
let stderrTail = "";

function resetWorkerState() {
  workerReader?.removeAllListeners();
  workerReader?.close();
  workerReader = null;
  worker = null;

  const error = new Error(stderrTail || "rembg worker stopped unexpectedly");
  for (const task of pendingTasks) {
    task.reject(error);
  }
  pendingTasks = [];
}

function ensureWorker(pythonBin: string, workerScriptPath: string) {
  if (worker) {
    return worker;
  }

  stderrTail = "";
  worker = spawn(pythonBin, ["-u", workerScriptPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  workerReader = createInterface({ input: worker.stdout });
  workerReader.on("line", (line) => {
    const task = pendingTasks.shift();
    if (!task) {
      return;
    }

    try {
      const payload = JSON.parse(line) as { ok?: boolean; error?: string };
      if (payload.ok) {
        task.resolve();
        return;
      }

      task.reject(new Error(payload.error || "rembg worker returned an unknown error"));
    } catch {
      task.reject(new Error(`Invalid worker response: ${line}`));
    }
  });

  worker.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderrTail = `${stderrTail}${text}`.slice(-4000);
  });

  worker.on("error", () => {
    resetWorkerState();
  });

  worker.on("close", () => {
    resetWorkerState();
  });

  return worker;
}

function runRembgWithWorker(
  pythonBin: string,
  workerScriptPath: string,
  inputPath: string,
  outputPath: string,
) {
  const task = workerQueue.then(
    () =>
      new Promise<void>((resolve, reject) => {
        const activeWorker = ensureWorker(pythonBin, workerScriptPath);
        pendingTasks.push({ resolve, reject });

        const payload = JSON.stringify({ inputPath, outputPath });
        const written = activeWorker.stdin.write(`${payload}\n`);
        if (written) {
          return;
        }

        activeWorker.stdin.once("drain", () => {
          // No-op: completion is handled when a stdout line is received.
        });
      }),
  );

  workerQueue = task.catch(() => undefined);
  return task;
}

export async function POST(request: Request) {
  let tempDir = "";

  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    const workerScriptPath = join(process.cwd(), "scripts", "remove_bg_worker.py");
    const pythonBin = process.env.REMBG_PYTHON_BIN || "python3";

    tempDir = await mkdtemp(join(tmpdir(), "rembg-"));
    const inputPath = join(tempDir, image.name || "input.jpg");
    const outputPath = join(tempDir, "output.png");

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    await writeFile(inputPath, imageBuffer);

    await runRembgWithWorker(pythonBin, workerScriptPath, inputPath, outputPath);

    const outputBuffer = await readFile(outputPath);

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
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
