import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/brand";

export const alt = `${APP_NAME}: pendaftaran, e-tiket QR, check-in, dan sertifikat acara dalam satu tempat`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "assets/fonts");

export default async function OpengraphImage() {
  const [semiBold, bold] = await Promise.all([
    readFile(join(fontDir, "plus-jakarta-sans-600.ttf")),
    readFile(join(fontDir, "plus-jakarta-sans-700.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f7f7f7",
          color: "#252525",
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 600,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{APP_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#0f766e" }}>Untuk panitia seminar, workshop, dan meetup</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 980 }}>
            Dari pendaftaran sampai sertifikat, semua di {APP_NAME}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["Pendaftaran", "E-tiket QR", "Check-in", "Sertifikat bertanda tangan"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid #ebebeb",
                fontSize: 22,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plus Jakarta Sans", data: semiBold, weight: 600, style: "normal" },
        { name: "Plus Jakarta Sans", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
