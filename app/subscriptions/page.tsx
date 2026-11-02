// Subscriptions retain the old dedicated tab but share the same SQLite records.
import { ProductList } from "../../components/product-list";
export const dynamic = "force-dynamic";
export default async function Subscriptions({searchParams}:{searchParams:Promise<{filter?:string;q?:string;sort?:string}>}) {
  const {filter="active",q="",sort="name"} = await searchParams;
  return <ProductList kind="Subscription" filter={filter} search={q} sort={sort}/>;
}
