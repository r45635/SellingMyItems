"use client";

import { useEffect, useMemo, useState } from "react";

type LocalizedDateTimeProps = {
  value: Date | string;
  className?: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function LocalizedDateTime({
  value,
  className,
}: LocalizedDateTimeProps) {
  const isoValue = useMemo(
    () => (value instanceof Date ? value.toISOString() : value),
    [value]
  );
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(formatDateTime(isoValue));
  }, [isoValue]);

  return (
    <time dateTime={isoValue} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  );
}