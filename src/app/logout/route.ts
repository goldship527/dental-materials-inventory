import { NextResponse, type NextRequest } from "next/server";
import { activeClinicCookieName } from "@/lib/db/clinic";

const authCookieNames = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
];

function clearAuthCookies(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  const cookieNames = new Set(authCookieNames);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.includes("authjs") || cookie.name.includes("next-auth")) {
      cookieNames.add(cookie.name);
    }
  }

  cookieNames.add(activeClinicCookieName);

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}

export function GET(request: NextRequest) {
  return clearAuthCookies(request);
}

export function POST(request: NextRequest) {
  return clearAuthCookies(request);
}
