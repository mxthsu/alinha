import { redirect } from "next/navigation";

/** Kept for existing bookmarks; the candidate journey now contains both steps. */
export default function AnalyzeRedirect() {
  redirect("/preparar#vaga");
}
