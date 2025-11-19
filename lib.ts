import { type PDFPageProxy } from "pdfjs-dist";
import { type TextItem } from "pdfjs-dist/types/src/display/api";

type OptionsFilter = { includeItem: (item: TextItem) => boolean };
type OptionsColumn = { columnFilter: "none" | "left" | "right" };

type Options = OptionsFilter | OptionsColumn;

export async function getLines(
  page: PDFPageProxy,
  options?: Options,
): Promise<TextItem[][]> {
  if (!options) {
    return getLines(page, { columnFilter: "none" });
  } else if ("columnFilter" in options) {
    const pageWidth = page.getViewport({ scale: 1.0 }).width;
    return getLines(page, {
      includeItem: (item: TextItem) => {
        if (!isItemHorizontal(item)) return false;

        const x = item.transform[4];
        const width = item.width;
        const midpoint = pageWidth / 2;

        if (options.columnFilter === "left") {
          return x < midpoint;
        }
        if (options.columnFilter === "right") {
          return x + width > midpoint;
        }
        return true;
      },
    });
  }
  return getLinesInternal(page, options);
}

async function getLinesInternal(
  page: PDFPageProxy,
  options: OptionsFilter,
): Promise<TextItem[][]> {
  const textContent = await page.getTextContent();
  const items = textContent.items.filter(((item) => {
    if (!("str" in item) || item.str.trim().length === 0 || item.width <= 0) {
      return false;
    }
    return options.includeItem(item);
  }) as (item: any) => item is TextItem);

  const filteredItems = filterNoiseItems(items);

  const lines = groupItemsIntoLines(filteredItems, doYIntervalsIntersect);

  lines.sort((lineA, lineB) => lineMedianY(lineB) - lineMedianY(lineA));

  return lines;
}

function doYIntervalsIntersect(itemA: TextItem, itemB: TextItem): boolean {
  const eps = 0.5;
  const y1_a = itemA.transform[5];
  const y2_a = y1_a + itemA.height;
  const y1_b = itemB.transform[5];
  const y2_b = y1_b + itemB.height;
  return (
    (y1_a <= y2_b - eps && y1_b <= y2_a - eps) ||
    (y1_b <= y2_a - eps && y1_a <= y2_b - eps)
  );
}

function filterNoiseItems(items: TextItem[]): TextItem[] {
  const itemsToIgnore = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    const itemA = items[i]!;
    for (let j = i + 1; j < items.length; j++) {
      const itemB = items[j]!;

      // If y-intervals intersect and one is much wider than the other, mark the narrow one to be ignored.
      if (doYIntervalsIntersect(itemA, itemB)) {
        const widthRatio = itemA.width / itemB.width;
        if (widthRatio > 10) {
          // itemA is much wider than itemB
          itemsToIgnore.add(j);
        } else if (widthRatio < 0.1) {
          // itemB is much wider than itemA
          itemsToIgnore.add(i);
        }
      }
    }
  }
  return items.filter((_, index) => !itemsToIgnore.has(index));
}

function groupItemsIntoLines(
  items: TextItem[],
  shouldCombine: (itemA: TextItem, itemB: TextItem) => boolean,
): TextItem[][] {
  // Build adjacency list on the filtered items
  const adj: number[][] = new Array(items.length).fill(0).map(() => []);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i]!;
      const itemB = items[j]!;
      if (shouldCombine(itemA, itemB)) {
        adj[i]!.push(j);
        adj[j]!.push(i);
      }
    }
  }

  // Find connected components (lines) using BFS on the filtered graph
  const visited = new Array(items.length).fill(false);
  const lines = [];
  for (let i = 0; i < items.length; i++) {
    if (!visited[i]) {
      const componentItems: TextItem[] = [];
      const queue = [i];
      visited[i] = true;

      let head = 0;
      while (head < queue.length) {
        const u = queue[head++]!;
        componentItems.push(items[u]!);

        for (const v of adj[u]!) {
          if (!visited[v]) {
            visited[v] = true;
            queue.push(v);
          }
        }
      }
      lines.push(componentItems);
    }
  }

  return lines;
}

export function lineMedianY(lineItems: TextItem[]) {
  return computeWeightedMedian(
    lineItems,
    (item) => item.transform[5],
    (item) => item.width,
  );
}

export function computeWeightedMedian<T>(
  items: T[],
  getValue: (item: T) => number,
  getWeight: (item: T) => number,
) {
  if (items.length === 0) {
    throw new Error("Cannot compute median of empty array");
  }
  const sorted = items.toSorted((a, b) => getValue(a) - getValue(b));
  const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
  let cumulativeWeight = 0;

  for (const item of sorted) {
    cumulativeWeight += getWeight(item);
    if (cumulativeWeight >= totalWeight / 2) {
      return getValue(item);
    }
  }
  return getValue(sorted[sorted.length - 1]!);
}

export function isItemHorizontal(item: TextItem) {
  return Math.abs(item.transform[1]) < 0.01;
}
