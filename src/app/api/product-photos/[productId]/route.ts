import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

const uploadDirectory = path.join(process.cwd(), "data", "local", "uploads", "products");
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const { productId } = await params;
  const assignment = await prisma.userClinicAssignment.findFirst({
    where: {
      userId: session.user.id,
      clinic: {
        organizationId: session.user.organizationId,
      },
    },
    select: {
      clinicId: true,
    },
    orderBy: {
      clinicId: "asc",
    },
  });

  if (!assignment) {
    return new Response("Not Found", {
      status: 404,
    });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId: session.user.organizationId,
      isActive: true,
      stockItems: {
        some: {
          clinicId: assignment.clinicId,
          isUsed: true,
        },
      },
    },
    select: {
      photoFileName: true,
      photoMimeType: true,
    },
  });

  if (!product?.photoFileName || !product.photoMimeType || !allowedMimeTypes.has(product.photoMimeType)) {
    return new Response("Not Found", {
      status: 404,
    });
  }

  try {
    const fileName = path.basename(product.photoFileName);
    const filePath = path.join(uploadDirectory, fileName);
    const bytes = await readFile(filePath);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": product.photoMimeType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not Found", {
      status: 404,
    });
  }
}
