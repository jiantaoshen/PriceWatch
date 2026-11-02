"use server";
// Human review decisions are the only way suspicious prices enter history.
import { redirect } from "next/navigation";
import { resolveReview } from "../../lib/reviews";
export async function reviewAction(form:FormData) {
  const decision=form.get("decision")==="approve"?"Approved":"Rejected";
  resolveReview(Number(form.get("id")),decision);
  redirect("/reviews");
}
