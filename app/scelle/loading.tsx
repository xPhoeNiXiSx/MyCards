import { SCOPES } from "@/lib/collection";

import { InventorySkeleton } from "../skeletons";

export default function Loading() {
  return <InventorySkeleton title={SCOPES.sealed.title} />;
}
