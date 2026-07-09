// Design-sync bundle entry. Re-exports ONLY the curated design-system surface
// so esbuild never pulls the app's server/data code into the browser IIFE.
// Sub-components (CardHeader, TabsTrigger, …) are exported too so authored
// previews can compose them off window.ContentAutomation.

export { Button, IconButton } from "@/components/ui/Button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
export { Badge, StatusBadge, TypeBadge } from "@/components/ui/Badge";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
export { Input, Textarea } from "@/components/ui/Input";
export { SliderDial } from "@/components/ui/SliderDial";
export { ScoreDial } from "@/components/assistant/ScoreDial";
