import { PageHeader } from "@/components/shared/PageHeader";
import { JourneyBuilder } from "@/components/journeys/builder/JourneyBuilder";

export default function NewJourneyPage() {
  return (
    <div>
      <PageHeader title="New journey" />
      <JourneyBuilder />
    </div>
  );
}
