import AppShell from "@/components/app-shell";
import HistoryContent from "./history-content";

export default function HistoryPage() {
  return <AppShell eyebrow="History" title="Your recent meals"><HistoryContent /></AppShell>;
}
