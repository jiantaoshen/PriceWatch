// Original Products dashboard; data now comes directly from local SQLite.
import { ProductList } from "../components/product-list";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{filter?:string;q?:string;sort?:string}>}) {
  const {filter="active",q="",sort="name"} = await searchParams;
  return <ProductList kind="Product" filter={filter} search={q} sort={sort}/>;
}
