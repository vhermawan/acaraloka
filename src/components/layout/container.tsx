import { cn } from "@/lib/utils";

function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn(
        "mx-auto w-full max-w-(--content-max-width) px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}

export { Container };
