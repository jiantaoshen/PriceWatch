import {
  Card,
  CardContent,
  CardHeader,
} from "@pricewatch/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map(
        (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>

            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-1/2" />

              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>

              <Skeleton className="h-12" />
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
