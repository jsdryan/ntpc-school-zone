import SchoolZoneExplorer from "@/components/school-zone-explorer";
import schoolZoneData from "@/data/school-zones.json";
import type { SchoolZonePayload } from "@/types/school-zones";

export default function Home() {
  return (
    <SchoolZoneExplorer payload={schoolZoneData as SchoolZonePayload} />
  );
}
