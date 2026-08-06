type PhoneLearner = { id: string; name: string; phone: string };

type ParentPortalPhoneDialogProps = {
  learner: PhoneLearner | null;
  phone: string;
  saving: boolean;
  onPhoneChange: (phone: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ParentPortalPhoneDialog({
  learner,
  phone,
  saving,
  onPhoneChange,
  onConfirm,
  onClose,
}: ParentPortalPhoneDialogProps) {
  if (!learner) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-phone-title"
      className="db-parent-access-dialog-backdrop"
    >
      <div className="db-soft-card db-parent-access-dialog">
        <h2 id="portal-phone-title" style={{ marginTop: 0 }}>
          Update Parent Portal Number
        </h2>
        <p className="db-helper">
          Learner: <strong>{learner.name}</strong>. This changes Parent Portal
          access for this learner only.
        </p>
        <label style={{ display: "grid", gap: 6 }}>
          <strong>New South African mobile number</strong>
          <input
            className="db-input"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="0821234567"
          />
        </label>
        <div className="db-parent-access-dialog-actions">
          <button
            type="button"
            className="db-button-primary"
            onClick={onConfirm}
            disabled={saving || !phone.trim()}
          >
            {saving ? "Updating..." : "Confirm Update"}
          </button>
          <button
            type="button"
            className="db-button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
