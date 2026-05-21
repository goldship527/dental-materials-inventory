import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getProductPhotoObject, productPhotoAllowedMimeTypes } from "@/lib/storage/product-photos";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

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

  if (!product?.photoFileName || !product.photoMimeType || !productPhotoAllowedMimeTypes.has(product.photoMimeType)) {
    return new Response("Not Found", {
      status: 404,
    });
  }

  try {
    const photoObject = await getProductPhotoObject(product.photoFileName);

    if (!photoObject) {
      return new Response("Not Found", {
        status: 404,
      });
    }

    return new Response(photoObject.body, {
      headers: {
        "Content-Type": product.photoMimeType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error(error);

    return new Response("Photo storage error", {
      status: 500,
    });
  }
}
