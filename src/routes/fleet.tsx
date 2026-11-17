import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { pageHead } from "@/lib/meta";

const FleetMap = lazy(() => import("@/components/partner/FleetMap"));

export const Route = createFileRoute("/fleet")({
  head: pageHead("Fleet oversight", "Locate vehicles, review service delivery and respond to exceptions."),
  component: Fleet,
});

function Fleet() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const o = new MutationObserver(read);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);

  return (
    <ClientOnly fallback={<div className="grid h-[640px] place-items-center text-sm text-muted-foreground">Loading fleet workspace…</div>}>
      <Suspense fallback={<div className="grid h-[640px] place-items-center text-sm text-muted-foreground">Loading fleet workspace…</div>}>
        <FleetMap dark={dark} />
      </Suspense>
    </ClientOnly>
  );
}
