"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <p className="chart-deferred-status" role="status">Loading chart…</p>,
});

type LazyEChartsProps = ComponentProps<typeof ReactECharts>;

export function LazyECharts({ style, ...props }: LazyEChartsProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    if (!("IntersectionObserver" in window)) {
      const fallbackTimer = setTimeout(() => setShouldLoad(true), 0);
      return () => clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "320px 0px" });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const reservedHeight = typeof style?.minHeight === "number"
    ? style.minHeight
    : typeof style?.height === "number"
      ? style.height
      : 280;
  const placeholderStyle: CSSProperties = { minHeight: reservedHeight };

  return <div ref={anchorRef} className="lazy-chart" style={placeholderStyle} aria-busy={!shouldLoad}>
    {shouldLoad
      ? <ReactECharts {...props} style={{ width: "100%", ...style }} />
      : <p className="chart-deferred-status" role="status">Chart will load when visible.</p>}
  </div>;
}
