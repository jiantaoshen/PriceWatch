/**
 * File: hooks/useProductHistory.ts
 * Purpose:
 *   Builds total/unit history and statistics from accepted history snapshots.
 *   Suspicious/failed latest candidates are never used as historical fallback.
 *
 * Main function:
 *   - useProductHistory(product, history): returns chart points and low/high/average.
 *
 * Inputs:
 *   Merged Product plus compact accepted HistoryDataFile snapshots.
 *
 * Outputs:
 *   History rows, chart points, and total/unit price statistics.
 */

import { useMemo } from "react";

import type { HistoryDataFile, Product } from "@/types/product";


export interface ProductHistoryPoint {
  period: string;
  price: number | null;
  unitPrice: number | null;
}

export interface PriceChartPoint {
  period: string;
  value: number;
}


export function useProductHistory(product: Product, history: HistoryDataFile[]) {
  return useMemo(() => {
    const historyPoints: ProductHistoryPoint[] = [...history]
      .sort((a, b) => a.period.localeCompare(b.period))
      .flatMap(period => {
        const item = period.data.find(
          candidate => candidate.product_id === product.product_id,
        );

        if (!item) return [];

        const price = item.current_price ?? null;
        const unitPrice = item.current_unit_price ?? null;

        if (price === null && unitPrice === null) return [];

        return [{
          period: period.period,
          price,
          unitPrice,
        }];
      });

    const totalChartData: PriceChartPoint[] = historyPoints.flatMap(item =>
      item.price === null
        ? []
        : [{ period: item.period, value: item.price }],
    );

    const unitChartData: PriceChartPoint[] = historyPoints.flatMap(item =>
      item.unitPrice === null
        ? []
        : [{ period: item.period, value: item.unitPrice }],
    );

    const totalPrices = totalChartData.map(item => item.value);
    const unitPrices = unitChartData.map(item => item.value);
    const acceptedCurrentPrice =
      product.status === "success" ? product.current_price : null;
    const acceptedCurrentUnitPrice =
      product.status === "success" ? product.current_unit_price ?? null : null;

    return {
      historyPoints,
      totalChartData,
      unitChartData,

      totalLow: totalPrices.length
        ? Math.min(...totalPrices)
        : acceptedCurrentPrice,

      totalHigh: totalPrices.length
        ? Math.max(...totalPrices)
        : acceptedCurrentPrice,

      totalAverage:
        average(totalPrices) ??
        acceptedCurrentPrice,

      unitLow: unitPrices.length
        ? Math.min(...unitPrices)
        : acceptedCurrentUnitPrice,

      unitHigh: unitPrices.length
        ? Math.max(...unitPrices)
        : acceptedCurrentUnitPrice,

      unitAverage:
        average(unitPrices) ??
        acceptedCurrentUnitPrice,
    };
  }, [
    history,
    product.product_id,
    product.current_price,
    product.current_unit_price,
    product.status,
  ]);
}


function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}