import { createFileRoute } from "@tanstack/react-router";
import { UploadPipeline } from "@/components/openats/UploadPipeline";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <UploadPipeline />;
}
