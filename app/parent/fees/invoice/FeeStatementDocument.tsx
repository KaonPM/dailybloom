"use client";

export type FeeStatementRow = {
  id: string;
  date: string;
  activity: string;
  invoiced: number;
  payment: number;
  runningTotal: number;
  detail?: string | null;
};

export type FeeStatementSchool = {
  school_name?: string | null;
  logo_url?: string | null;
  contact_number?: string | null;
  email_address?: string | null;
  physical_address?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

type Props = {
  school: FeeStatementSchool | null;
  learnerName: string;
  statementDate: string;
  nextPaymentDate: string;
  monthlyFee: number;
  balance: number;
  rows: FeeStatementRow[];
  statementTitle?: string;
  backHref?: string;
  backLabel?: string;
};

const money = (value: number) =>
  `R${Math.abs(Number(value || 0)).toFixed(2)}`;

const accountPosition = (value: number) =>
  value < 0
    ? `-${money(value)} credit`
    : value > 0
      ? `${money(value)} due`
      : "R0.00";

export default function FeeStatementDocument({
  school,
  learnerName,
  statementDate,
  nextPaymentDate,
  monthlyFee,
  balance,
  rows,
  statementTitle = "Fee Statement",
  backHref = "/parent/fees",
  backLabel = "Back",
}: Props) {
  const primary = school?.primary_color || "#75C7EA";
  const secondary = school?.secondary_color || "#F8F4FF";

  return (
    <article className="fee-print-statement fee-document">
      <div className="fee-document-actions">
        <a className="db-button-secondary" href={backHref}>
          {backLabel}
        </a>
        <button
          type="button"
          className="db-button-primary"
          onClick={() => window.print()}
        >
          Print or Save PDF
        </button>
      </div>

      <header className="fee-document-header" style={{ borderColor: primary }}>
        <div className="fee-document-brand">
          {school?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo_url}
              alt={`${school.school_name || "Preschool"} logo`}
            />
          ) : (
            <div className="fee-document-logo-placeholder">DB</div>
          )}
          <div>
            <h2>{school?.school_name || "Preschool"}</h2>
            {school?.physical_address ? <p>{school.physical_address}</p> : null}
            <p className="fee-document-muted">
              {[school?.contact_number, school?.email_address]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </div>
        </div>
        <div className="fee-document-title">
          <h1>{statementTitle}</h1>
          <p>{statementTitle === "Monthly Fee Statement" ? "Selected billing month" : "Continuous learner account"}</p>
        </div>
      </header>

      <section
        className="fee-document-identity"
        style={{ background: secondary }}
      >
        <div>
          <strong>Billed to</strong>
          <p>{learnerName}</p>
        </div>
        <div>
          <strong>Statement date</strong>
          <p>{statementDate}</p>
        </div>
        <div>
          <strong>Next payment due</strong>
          <p>{nextPaymentDate}</p>
        </div>
      </section>

      <section>
        <h2 className="fee-document-section-title">Billing</h2>
        <p className="fee-document-helper">
          Registration fees, monthly charges and recorded payments remain on
          this continuous statement.
        </p>

        {rows.length ? (
          <div className="fee-document-table-wrap">
            <table className="fee-document-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account activity</th>
                  <th>Billed</th>
                  <th>Payment</th>
                  <th>Running total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>
                      <strong>{row.activity}</strong>
                      {row.detail ? (
                        <small className="fee-document-muted">
                          {row.detail}
                        </small>
                      ) : null}
                    </td>
                    <td>{row.invoiced ? money(row.invoiced) : "-"}</td>
                    <td>{row.payment ? money(row.payment) : "-"}</td>
                    <td>{accountPosition(row.runningTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fee-document-empty">No fee activity recorded yet.</div>
        )}
      </section>

      <aside className="fee-document-total" style={{ background: secondary }}>
        <span>Running total</span>
        <strong>{accountPosition(balance)}</strong>
        {monthlyFee > 0 ? (
          <small>
            Next monthly fee {money(monthlyFee)} - due {nextPaymentDate}
          </small>
        ) : null}
      </aside>

      <footer className="fee-document-footer">
        <span>
          Issued by {school?.school_name || "the preschool"} through DailyBloom
        </span>
        <span>Preschool management made simpler</span>
      </footer>
    </article>
  );
}
