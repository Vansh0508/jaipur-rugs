import { PageHeader } from "@/components/shared/PageHeader";
import { NewJourneyForm } from "@/components/journeys/new/NewJourneyForm";

export default function NewJourneyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Plan a new journey" />
      <NewJourneyForm />
    </div>
  );
}
