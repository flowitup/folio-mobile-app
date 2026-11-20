import { Children, useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";

import { kpiColumns } from "@/lib/dashboard/fit-figure";

const GAP = 8;

type Props = {
  children: ReactNode;
  /** Narrowest card that still shows its widest figure whole. */
  minCardWidth: number;
  testID?: string;
};

/**
 * A row of KPI cards that becomes two columns when three no longer fit their figures
 * (a 360 px phone, large text): the third card then spans the row below.
 */
export function KpiRow({ children, minCardWidth, testID }: Props) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children).filter(Boolean);
  const columns = kpiColumns(items.length, width, GAP, minCardWidth);
  const basis = columns < items.length ? (width - GAP) / 2 : undefined;
  return (
    <View
      testID={testID}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="flex-row flex-wrap"
      style={{ gap: GAP }}
    >
      {items.map((child, index) => (
        <View
          key={index}
          style={
            basis === undefined
              ? { flex: 1 }
              : { flexBasis: basis, flexGrow: 1 }
          }
        >
          {child}
        </View>
      ))}
    </View>
  );
}
