# 05. Prompt untuk pen.dev

Tempel prompt ini satu per satu. Sebelum prompt pertama, lampirkan `01-brand.md` dan `03-components.md` sebagai konteks.

## Prompt 0: setup gaya

```
Set up a design system for "Hadirly", an Indonesian event management app for seminar, workshop, and meetup organizers.
Colors: primary #0F766E (dark mode #2DD4BF), background #FFFFFF, foreground #252525, muted #F7F7F7, muted-foreground #8E8E8E, border #EBEBEB.
Status colors: success #16A34A, warning #CA8A04, danger #DC2626.
Fonts: Plus Jakarta Sans for UI, Geist Mono for codes and certificate numbers.
Radius 8px for buttons and inputs, 12px for cards. Thin 1px borders, very light shadows.
Icons: Lucide, 1.5px stroke.
Avoid gradients, glow, blobs, 3D icons, emoji in headings. Copy is in Bahasa Indonesia, casual-polite, using "kamu".
```

## Prompt 1: komponen dasar

```
Create reusable components: Button (default, outline, ghost, inverse; sizes sm 32px, default 40px, lg 48px), Badge (default, secondary, destructive, outline, soon), Card, SectionHeader (eyebrow + H2 + paragraph), PhoneFrame (300x620), CheckinResultScreen (valid green, already-checked-in yellow, invalid red), TicketCard with QR, CertificateMock (A4 landscape, serif participant name, 1-3 signature blocks, QR + mono certificate number bottom right, small "Diterbitkan via Hadirly" footer, optional diagonal "PRATINJAU" watermark), FAQItem accordion, PromptInput with suggestion chips.
Follow the specs in 03-components.md.
```

## Prompt 2: header + hero (desktop 1440)

```
Desktop frame 1440px wide, content max 1200px. Build the sticky header and hero section for Hadirly following section 0 and 1 of 02-landing-page.md.
Hero: two columns. Left: small teal eyebrow "Untuk panitia seminar, workshop, dan meetup", H1 56px "Dari pendaftaran sampai sertifikat, semua di Hadirly", subtitle, primary button "Buat acara gratis", outline button "Lihat cara kerjanya", small note "Gratis untuk acara tanpa tiket berbayar. Masuk pakai akun Google."
Right: layered product composition: certificate in the back, phone showing green VALID check-in screen in the middle, small e-ticket card in front. Use sample names "Rina Pratama" and "Workshop Desain UI Dasar".
```

## Prompt 3: masalah + cara kerja

```
Below the hero, add section 2 (problem strip on muted background, 4 items with grey x icons) and section 3 (4-step horizontal timeline with large Geist Mono numbers 01-04 connected by a thin line). Copy from 02-landing-page.md.
```

## Prompt 4: bento fitur

```
Add section 4: bento grid, 3 columns, cards of different sizes as specified in the table in 02-landing-page.md (card A spans 2 columns and is tall, card B is tall). Each card has a product UI fragment on top (muted background) and H3 + body below. Card A shows three check-in states side by side. Do not make all cards identical.
```

## Prompt 5: sorotan sertifikat + AI segera hadir

```
Add section 5: large centered CertificateMock with thin callout lines pointing to "Nama otomatis mengecil kalau panjang", "Tanda tangan penandatangan", "QR ke halaman verifikasi". Text block with eyebrow "Sertifikat", H2 "Sertifikat bertanda tangan, hanya untuk yang hadir", body, and 3 checklist rows.
Then section 6: wide card with thin teal border and "Segera hadir" badge. Left: PromptInput with the example prompt. Right: three certificate template thumbnails in different styles (formal, minimal, colorful).
```

## Prompt 6: peran, harga, FAQ, CTA, footer

```
Add sections 7 to 11 from 02-landing-page.md:
7. Three role columns: Panitia, Peserta, Penandatangan.
8. Pricing with two cards: "Acara gratis" Rp0 (badge "Tersedia sekarang", primary button) and "Acara berbayar" (badge "Segera hadir", price shown as placeholder, no button).
9. FAQ accordion with 6 questions, first one open.
10. Closing CTA: the only full teal block on the page, white text centered, inverse button "Buat acara gratis".
11. Footer with wordmark, one-line description, link columns Produk / Legal / Akun, and "© 2026 Hadirly."
Do not add testimonials, user counts, or partner logos.
```

## Prompt 7: versi mobile

```
Create a mobile version of the whole landing page at 390px width with 16px side margins. H1 36px. Hero visual simplified to phone + certificate only. Bento grid becomes one column in order A, B, E, C, D. How-it-works timeline becomes vertical with the line on the left. Header collapses to wordmark + menu button. All tap targets at least 44px.
```

## Prompt 8: layar AI template (halaman terpisah)

```
On a new page, design the AI certificate template flow from 04-ai-certificate.md as desktop frames (1280px, inside the organizer dashboard layout):
A. Template source choice (built-in vs "Buat dengan AI" with "Baru" badge)
B. Prompt form with style chips, optional logo upload, optional main color, info note, remaining quota
C. Generating state with 3 shimmering skeleton certificates
D. Results: 3 CertificateMocks with "Pakai template ini" and "Buat variasi"
E. Error state
F. Existing position editor with AI background and a small "Dibuat dengan AI" label
```

## Prompt 9: dark mode

```
Duplicate the desktop landing page and apply dark mode tokens: background #252525, foreground #FAFAFA, muted #454545, primary #2DD4BF with dark text on primary buttons. Keep the certificate mock white because it represents a printed document.
```
