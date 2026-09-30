import { PageHeader } from "@/components/shared/PageHeader";
import { JourneyRequestBuilder } from "@/components/journey/JourneyRequestBuilder";

export default function JourneyBookingPage() {
  return (
    <div>
      <PageHeader
        title="Journey booking"
        description="Plan the trip — who's travelling, where from and to, and when. The admin team approves every request and assigns the car and driver."
      />
      <JourneyRequestBuilder />
    </div>
  );
}
