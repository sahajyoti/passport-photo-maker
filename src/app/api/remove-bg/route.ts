import { removeBackground } from "@imgly/background-removal";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const blob = new Blob([imageBuffer], { type: image.type });
    const outputBlob = await removeBackground(blob);
    const outputBuffer = Buffer.from(await outputBlob.arrayBuffer());


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
  }
}
