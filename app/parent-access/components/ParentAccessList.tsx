export type LinkedLearner = { id: string; name: string };

export type ParentGroup = {
  phone: string;
  parent_name: string;
  learners: LinkedLearner[];
  status: string;
  invite_sent_at?: string | null;
  invite_error?: string | null;
};

export const PARENTS_PER_PAGE = 20;

type ParentAccessListProps = {
  groups: ParentGroup[];
  selected: string[];
  page: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onToggle: (phone: string) => void;
  onToggleVisible: (phones: string[], allSelected: boolean) => void;
  onEditPhone: (learner: LinkedLearner, phone: string) => void;
};

function statusBackground(status: string) {
  if (status === "active") return "#EEF9EE";
  if (status === "failed") return "#FDECEC";
  return "#FFF7D9";
}

export function ParentAccessList({
  groups,
  selected,
  page,
  searchQuery,
  onSearchChange,
  onPageChange,
  onToggle,
  onToggleVisible,
  onEditPhone,
}: ParentAccessListProps) {
  const totalPages = Math.max(
    1,
    Math.ceil(groups.length / PARENTS_PER_PAGE)
  );
  const pageStart = (page - 1) * PARENTS_PER_PAGE;
  const visibleGroups = groups.slice(
    pageStart,
    pageStart + PARENTS_PER_PAGE
  );
  const visibleSelectable = visibleGroups.filter(
    (group) => group.status !== "active"
  );
  const allVisibleSelected =
    visibleSelectable.length > 0 &&
    visibleSelectable.every((group) => selected.includes(group.phone));
  const visiblePhones = visibleSelectable.map((group) => group.phone);
  const searchIsActive = searchQuery.trim().length >= 3;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="db-soft-card" style={{ padding: 16 }}>
        <label htmlFor="parent-access-search" style={{ display: "grid", gap: 7 }}>
          <strong>Find a parent or learner</strong>
          <input
            id="parent-access-search"
            className="db-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Enter a name or surname"
            autoComplete="off"
          />
        </label>
        <p className="db-helper" style={{ margin: "7px 0 0" }}>
          Search starts after the first 3 letters and checks parent and learner names.
        </p>
      </div>

      {groups.length ? (
        <p className="db-helper" style={{ margin: 0 }}>
          Showing {pageStart + 1}-
          {Math.min(pageStart + PARENTS_PER_PAGE, groups.length)} of{" "}
          {groups.length} {searchIsActive ? "matching " : ""}parent portal account
          {groups.length === 1 ? "" : "s"}
        </p>
      ) : null}

      {visibleSelectable.length > 0 ? (
        <label className="db-soft-card db-parent-access-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={() =>
              onToggleVisible(visiblePhones, allVisibleSelected)
            }
          />
          <strong>Select all parents shown who require access</strong>
        </label>
      ) : null}

      {visibleGroups.map((group) => (
        <div key={group.phone} className="db-soft-card db-parent-access-card">
          <input
            type="checkbox"
            disabled={group.status === "active"}
            checked={selected.includes(group.phone)}
            onChange={() => onToggle(group.phone)}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="db-parent-access-row">
              <strong>{group.parent_name}</strong>
              <span
                className="db-parent-access-status"
                style={{ background: statusBackground(group.status) }}
              >
                {group.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="db-helper" style={{ margin: "3px 0 8px" }}>
              {group.phone}
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {group.learners.map((learner) => (
                <div key={learner.id} className="db-parent-access-row">
                  <span className="db-helper">
                    Learner: <strong>{learner.name}</strong>
                  </span>
                  <button
                    type="button"
                    className="db-button-secondary"
                    onClick={() => onEditPhone(learner, group.phone)}
                    style={{ padding: "6px 10px", minHeight: 0 }}
                  >
                    Update portal number
                  </button>
                </div>
              ))}
            </div>
            {group.invite_error ? (
              <p className="db-parent-access-error">{group.invite_error}</p>
            ) : null}
          </div>
        </div>
      ))}

      {!groups.length ? (
        <div className="db-soft-card" style={{ padding: 18 }}>
          {searchIsActive
            ? "No parent or learner matches that search."
            : "No parent contact numbers are available yet."}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="db-soft-card db-parent-access-pagination">
          <button
            type="button"
            className="db-button-secondary"
            disabled={page === 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Previous 20
          </button>
          <strong>
            Page {page} of {totalPages}
          </strong>
          <button
            type="button"
            className="db-button-secondary"
            disabled={page === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next 20
          </button>
        </div>
      ) : null}
    </div>
  );
}
