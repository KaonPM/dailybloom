"use client";

export type MonthlyFeeOption = {
  id: number;
  fee_code: string;
  fee_name: string;
  amount: number;
};

export function MonthlyFeeSetup({
  options,
  name,
  amount,
  saving,
  onNameChange,
  onAmountChange,
  onAdd,
  onRemove,
}: {
  options: MonthlyFeeOption[];
  name: string;
  amount: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (feeId: number) => void;
}) {
  const additional = options.filter(
    (fee) => fee.fee_code !== "monthly_school_fee"
  );

  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ margin: "0 0 8px", color: "#2D2A3E" }}>
        Additional Monthly Fee Options
      </h4>
      <p className="db-helper">
        Add rates for groups such as Babies or Toddlers. These appear in the
        learner fee dropdown.
      </p>
      <div style={twoColumnGrid}>
        <input
          className="db-input"
          placeholder="Fee name, e.g. Babies"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <input
          className="db-input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Monthly amount"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      </div>
      <button
        type="button"
        className="db-button-primary"
        disabled={saving}
        onClick={onAdd}
      >
        + Add Monthly Fee
      </button>

      {additional.length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {additional.map((fee) => (
            <div key={fee.id} style={optionRow}>
              <span>
                <strong>{fee.fee_name}</strong>
                {" · R"}
                {Number(fee.amount).toFixed(2)} / month
              </span>
              <button
                type="button"
                className="db-main-pill"
                disabled={saving}
                onClick={() => onRemove(fee.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LearnerMonthlyFeeSelect({
  options,
  value,
  onChange,
}: {
  options: MonthlyFeeOption[];
  value: string;
  onChange: (feeId: string, amount: number) => void;
}) {
  return (
    <select
      className="db-input"
      value={value}
      onChange={(event) => {
        const selected = options.find(
          (fee) => String(fee.id) === event.target.value
        );
        onChange(event.target.value, Number(selected?.amount || 0));
      }}
    >
      <option value="">Select monthly fee</option>
      {options.map((fee) => (
        <option key={fee.id} value={fee.id}>
          {fee.fee_name}
          {" · R"}
          {Number(fee.amount).toFixed(2)}
        </option>
      ))}
    </select>
  );
}

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginBottom: 10,
} as const;

const optionRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  border: "1px solid #E9DDF2",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#FFF",
} as const;
