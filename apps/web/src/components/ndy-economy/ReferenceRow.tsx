"use client";

export function ReferenceRow({
  colorHex,
  name,
  label,
  valueEur,
}: {
  colorHex: string;
  name: string;
  label: string;
  valueEur: string;
}) {
  return (
    <div className="eco-ref-row" style={{ "--card-c": colorHex } as React.CSSProperties}>
      <div>
        <div className="eco-ref-name">{name}</div>
        <div className="eco-ref-sub">{label}</div>
      </div>
      <div className="eco-ref-value">{valueEur}</div>
    </div>
  );
}
