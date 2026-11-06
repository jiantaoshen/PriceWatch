import { ProductList } from "../components/product-list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  filter?: string;
  q?: string;
  sort?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { filter = "active", q = "", sort = "name" } = await searchParams;

  return (
    <ProductList
      kind="Product"
      filter={filter}
      search={q}
      sort={sort}
    />
  );
}
