import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/meta";
import { PageHeader, Panel } from "@/components/partner/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  head: pageHead("Settings", "Partner profile, service areas and notification preferences."),
  component: Settings,
});

function Settings() {
  const { model, updateProfile, reset } = useStore();
  const [form, setForm] = useState(model.profile);
  const [confirm, setConfirm] = useState(false);
  const toggles = [
    ["notifyRequests", "New pickup and bin requests"],
    ["notifyMessages", "Customer and LAWMA messages"],
    ["notifyRemittance", "Remittance reminders"],
  ] as const;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" sub="Your partner profile and notification preferences." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Partner profile">
          <div className="space-y-4">
            {([["name", "Company name"], ["areas", "Service areas"], ["contact", "Contact"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label htmlFor={k}>{label}</Label>
                <Input id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <Button className="btn-heat" onClick={() => { updateProfile(form); toast.success("Profile saved"); }}>Save changes</Button>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Notifications" flush>
            <ul className="divide-y">
              {toggles.map(([k, label]) => (
                <li key={k} className="flex items-center justify-between px-5 py-3.5">
                  <Label htmlFor={k}>{label}</Label>
                  <Switch id={k} checked={form[k]} onCheckedChange={(v) => { setForm({ ...form, [k]: v }); updateProfile({ [k]: v }); }} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Statutory concession & settlement">
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Concession ID</dt><dd className="font-mono">{model.wardProfile.concessionId}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Statutory protection</dt><dd>{model.wardProfile.statutoryClause}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Escrow bank account</dt><dd className="font-mono">{model.wardProfile.bankAccount}</dd></div>
            </dl>
          </Panel>
          <Panel title="Workspace state">
            <p className="mb-4 text-sm text-muted-foreground">Restore the default ward concession ledger, routes, and escrow balances.</p>
            <Button variant="outline" onClick={() => setConfirm(true)}>Reset ward ledger</Button>
          </Panel>
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset ward ledger?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All local changes will be replaced with the baseline ward concession state.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { reset(); setConfirm(false); window.location.reload(); }}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
