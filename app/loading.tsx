import RouteStateCard from "./components/RouteStateCard";

export default function Loading() {
  return (
    <RouteStateCard
      eyebrow="DailyBloom"
      title="Opening your page"
      message="Please wait while DailyBloom prepares the latest information."
      busy
    />
  );
}
