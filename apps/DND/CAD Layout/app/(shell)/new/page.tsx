import { LayoutForm } from "@/components/layout-form/LayoutForm";

export default function NewLayoutPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">New CAD layout</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the layout type, upload the Tikni BMP for each design option, fill the rug details, and download the
          finished deck. The BMP itself never leaves this tool — only the rendered layout does.
        </p>
      </div>
      <LayoutForm />
    </div>
  );
}
