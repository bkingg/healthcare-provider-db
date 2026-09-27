import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProviderNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-xl font-semibold">Provider not found</h1>
      <p className="text-sm text-muted-foreground">This provider doesn&apos;t exist or may have been removed.</p>
      <Link href="/providers" className={cn(buttonVariants())}>
        Back to providers
      </Link>
    </div>
  );
}
