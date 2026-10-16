import { redirect } from "next/navigation";

/** Kept for existing bookmarks while the unified journey lives at /preparar. */
export default function AtsRedirect() {
  redirect("/preparar");
}
