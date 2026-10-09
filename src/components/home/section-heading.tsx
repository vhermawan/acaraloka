import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

function SectionHeading({ id, eyebrow, title, description, align = "left", className }: SectionHeadingProps) {
  return (
    <div className={cn("flex max-w-180 flex-col gap-3", align === "center" && "mx-auto items-center text-center", className)}>
      <p className="text-[13px]/4.5 font-semibold text-primary">{eyebrow}</p>
      <h2 id={id} className="text-[28px]/9 font-bold tracking-[-0.6px] text-balance text-foreground sm:text-4xl/[44px] sm:tracking-[-0.8px]">
        {title}
      </h2>
      {description ? <p className="text-[17px]/7 text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export { SectionHeading };
