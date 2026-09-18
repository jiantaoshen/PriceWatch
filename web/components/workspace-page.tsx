import { SiteHeader } from "@/components/site-header";

export function WorkspacePage({
  title,
  description,
  headerAction,
  children,
}: {
  title: string;
  description: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/15">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">
                {title}
              </h1>

              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {description}
              </p>
            </div>

            {headerAction && (
              <div className="shrink-0">
                {headerAction}
              </div>
            )}
          </div>

          {children}
        </section>
      </main>
    </div>
  );
}
