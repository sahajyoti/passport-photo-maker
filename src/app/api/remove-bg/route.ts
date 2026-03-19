import { removeBackground } from "@imgly/background-removal-node";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    const imageArrayBuffer = await image.arrayBuffer();
    const outputBlob = await removeBackground(imageArrayBuffer, {
      model: "small",
      publicPath: "https://cdn.jsdelivr.net/npm/${PACKAGE_NAME}@${PACKAGE_VERSION}/dist/",
      output: {
        format: "image/png",
      },
    });
    const outputBuffer = Buffer.from(await outputBlob.arrayBuffer());

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "x-remove-bg-engine": "imgly-node",
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
