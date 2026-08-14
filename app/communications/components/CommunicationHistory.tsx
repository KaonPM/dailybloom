import styles from "../communications.module.css";
import { CommunicationRow, PaginationData } from "../types";

function human(value?: string | null) {
  return String(value || "Not recorded")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function when(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-ZA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

type Props = {
  rows: CommunicationRow[];
  pagination: PaginationData;
  onPage: (page: number) => void;
  onView: (row: CommunicationRow) => void;
};

export default function CommunicationHistory({ rows, pagination, onPage, onView }: Props) {
  if (!rows.length) {
    return <div className={styles.empty}>No communication records match these filters.</div>;
  }

  const firstRecord = (pagination.page - 1) * pagination.pageSize + 1;
  const lastRecord = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Date &amp; time</th>
              <th>Parent / learner</th>
              <th>Class</th>
              <th>Type / subject</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Sent by</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{when(row.sent_at || row.created_at)}</td>
                <td>
                  <strong>{row.learner_name || row.recipient_name || "General"}</strong>
                  <small>
                    {row.recipient_phone ||
                      row.recipient_email ||
                      (row.recipient_count ? `${row.recipient_count} recipients` : "")}
                  </small>
                </td>
                <td>{row.classroom_name || "School-wide"}</td>
                <td>
                  <strong>{human(row.communication_type)}</strong>
                  <small>{row.subject || row.body_preview || ""}</small>
                </td>
                <td>{human(row.channel)}</td>
                <td>
                  <span className={`${styles.status} ${styles[`status_${row.status}`] || ""}`}>
                    {human(row.status)}
                  </span>
                </td>
                <td>{row.sent_by_name || "DailyBloom"}</td>
                <td>
                  <button className={styles.linkButton} type="button" onClick={() => onView(row)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pager}>
        <span>
          Showing {firstRecord}–{lastRecord} of {pagination.total}
        </span>
        <div>
          <button type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
            Previous
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPage(pagination.page + 1)}
          >
            Next 20
          </button>
        </div>
      </div>
    </>
  );
}
