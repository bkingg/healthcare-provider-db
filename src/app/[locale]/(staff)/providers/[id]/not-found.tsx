import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function ProviderNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-xl font-semibold">Provider not found</h1>
      <p className="text-sm text-muted-foreground">This provider doesn&apos;t exist or may have been removed.</p>
      <Button render={<Link href="/providers">Back to providers</Link>} />
    </div>
  );
}
