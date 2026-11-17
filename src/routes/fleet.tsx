import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead } from "@/lib/meta";
import FleetMap from "@/components/partner/FleetMap";

export const Route = createFileRoute("/fleet")({
  head: pageHead("Fleet oversight", "Locate vehicles, review service delivery and respond to exceptions."),
  component: Fleet,
});

function Fleet() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const o = new MutationObserver(read);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);

  if (!mounted) {
    return (
      <div className="grid h-[640px] place-items-center text-sm text-muted-foreground">
        Loading fleet workspace…
      </div>
    );
  }

  return <FleetMap dark={dark} />;
}
