import QRCode from "qrcode";

type TicketQrProps = {
  code: string;
  label: string;
};

async function TicketQr({ code, label }: TicketQrProps) {
  const svg = await QRCode.toString(code, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-72 rounded-lg bg-white p-2 [&_svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export { TicketQr };
