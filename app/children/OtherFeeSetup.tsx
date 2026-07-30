"use client";

type OtherFeeOption = {
  id: number;
  fee_name: string;
  amount: number;
};

export function OtherFeeSetup({
  options,
  name,
  amount,
  saving,
  onNameChange,
  onAmountChange,
  onAdd,
  onRemove,
}: {
  options: OtherFeeOption[];
  name: string;
  amount: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (feeId: number) => void;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <h4 style={{ margin: "0 0 8px", color: "#2D2A3E" }}>
        Additional Fees
      </h4>
      <p className="db-helper">
        Add each once-off fee separately. A fresh box remains available after
        every fee is saved.
      </p>

      <div style={entryBox}>
        <strong style={{ color: "#2D2A3E" }}>Add another fee</strong>
        <div style={twoColumnGrid}>
          <label>
            <span style={fieldLabel}>Fee name</span>
            <input
              className="db-input"
              placeholder="e.g. Excursion"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label>
            <span style={fieldLabel}>Amount</span>
            <input
              className="db-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="R0.00"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="db-button-primary"
          onClick={onAdd}
          disabled={saving}
        >
          + Save Additional Fee
        </button>
      </div>

      {options.length ? (
        <div style={savedGrid}>
          {options.map((fee, index) => (
            <article key={fee.id} style={savedFeeBox}>
              <div>
                <span style={eyebrow}>Additional fee {index + 1}</span>
                <strong style={{ display: "block", color: "#2D2A3E" }}>
                  {fee.fee_name}
                </strong>
                <span style={{ color: "#746B86" }}>
                  R{Number(fee.amount).toFixed(2)} once-off
                </span>
              </div>
              <button
                type="button"
                className="db-main-pill"
                onClick={() => onRemove(fee.id)}
                disabled={saving}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginTop: 10,
  marginBottom: 10,
} as const;

const entryBox = {
  border: "1px solid #CBEAFA",
  borderRadius: 16,
  padding: 14,
  background: "#F4FBFF",
} as const;

const savedGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 10,
  marginTop: 12,
} as const;

const savedFeeBox = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: "1px solid #E9DDF2",
  borderRadius: 14,
  padding: "12px 14px",
  background: "#FFF",
} as const;

const fieldLabel = {
  display: "block",
  marginBottom: 6,
  color: "#514768",
  fontWeight: 700,
} as const;

const eyebrow = {
  display: "block",
  marginBottom: 3,
  color: "#827397",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
} as const;
