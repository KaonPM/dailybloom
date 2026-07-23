"use client";

import { Permission, PermissionOption } from "../lib/permissions";

export default function PermissionChecklist({
  options,
  selected,
  onChange,
  disabled = false,
}: {
  options: readonly PermissionOption[];
  selected: readonly Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}) {
  const groups = [...new Set(options.map((option) => option.group))];

  function toggle(permission: Permission) {
    onChange(
      selected.includes(permission)
        ? selected.filter((item) => item !== permission)
        : [...selected, permission]
    );
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {groups.map((group) => (
        <fieldset
          key={group}
          disabled={disabled}
          style={{ border: "1px solid #E8DCD2", borderRadius: "16px", padding: "14px" }}
        >
          <legend style={{ padding: "0 7px", fontWeight: 800, color: "#2F2A4A" }}>{group}</legend>
          <div style={{ display: "grid", gap: "10px" }}>
            {options.filter((option) => option.group === group).map((option) => (
              <label
                key={option.permission}
                style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: "9px", cursor: disabled ? "default" : "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.permission)}
                  onChange={() => toggle(option.permission)}
                />
                <span>
                  <strong style={{ display: "block", color: "#26213F" }}>{option.label}</strong>
                  <span style={{ display: "block", color: "#766F86", fontSize: "13px", marginTop: "2px" }}>
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
