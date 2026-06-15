import React, { useState } from "react";

interface Condition {
  id: number;
  field: string;
  operator: string;
  value: string;
}

interface Action {
  id: number;
  type: string;
  params: string;
}

interface WorkflowRule {
  id: number;
  name: string;
  triggerEvent: string;
  conditions: Condition[];
  actions: Action[];
  active: boolean;
}

const triggerEvents = [
  "Lead Created",
  "Lead Updated",
  "Deal Created",
  "Deal Updated",
  "Account Created",
  "Account Updated",
];

const operators = ["=", "!=","<", ">", "<=", ">=", "contains"];

const actionTypes = ["Send Email", "Assign Owner", "Update Field", "Add Note"];

const AutomationWorkflowRules: React.FC = () => {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTriggerEvent, setFormTriggerEvent] = useState(triggerEvents[0]);
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formActions, setFormActions] = useState<Action[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Helpers to add new condition or action
  const addCondition = () => {
    setFormConditions((conds) => [
      ...conds,
      { id: Date.now(), field: "", operator: "=", value: "" },
    ]);
  };

  const updateCondition = (id: number, key: keyof Condition, val: string) => {
    setFormConditions((conds) =>
      conds.map((c) => (c.id === id ? { ...c, [key]: val } : c))
    );
  };

  const removeCondition = (id: number) => {
    setFormConditions((conds) => conds.filter((c) => c.id !== id));
  };

  const addAction = () => {
    setFormActions((acts) => [
      ...acts,
      { id: Date.now(), type: actionTypes[0], params: "" },
    ]);
  };

  const updateAction = (id: number, key: keyof Action, val: string) => {
    setFormActions((acts) =>
      acts.map((a) => (a.id === id ? { ...a, [key]: val } : a))
    );
  };

  const removeAction = (id: number) => {
    setFormActions((acts) => acts.filter((a) => a.id !== id));
  };

  const resetForm = () => {
    setFormName("");
    setFormTriggerEvent(triggerEvents[0]);
    setFormConditions([]);
    setFormActions([]);
    setFormActive(true);
    setEditingRule(null);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      alert("Please enter workflow name");
      return;
    }
    if (formConditions.length === 0) {
      alert("Add at least one condition");
      return;
    }
    if (formActions.length === 0) {
      alert("Add at least one action");
      return;
    }

    if (editingRule) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id
            ? {
                ...r,
                name: formName,
                triggerEvent: formTriggerEvent,
                conditions: formConditions,
                actions: formActions,
                active: formActive,
              }
            : r
        )
      );
    } else {
      const newRule: WorkflowRule = {
        id: Date.now(),
        name: formName,
        triggerEvent: formTriggerEvent,
        conditions: formConditions,
        actions: formActions,
        active: formActive,
      };
      setRules((prev) => [...prev, newRule]);
    }
    resetForm();
  };

  const handleEdit = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormTriggerEvent(rule.triggerEvent);
    setFormConditions(rule.conditions);
    setFormActions(rule.actions);
    setFormActive(rule.active);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this workflow rule?")) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (editingRule?.id === id) resetForm();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Automation Workflow Rules</h2>

      {/* Form */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          {editingRule ? "Edit Workflow Rule" : "Add New Workflow Rule"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Workflow Name"
            className="form-input"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <select
            className="form-select"
            value={formTriggerEvent}
            onChange={(e) => setFormTriggerEvent(e.target.value)}
          >
            {triggerEvents.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </div>

        {/* Conditions */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Conditions</h4>
          {formConditions.length === 0 && (
            <p className="text-gray-500 mb-2">No conditions added yet.</p>
          )}
          {formConditions.map((cond) => (
            <div
              key={cond.id}
              className="flex gap-2 items-center mb-2 flex-wrap"
            >
              <input
                type="text"
                placeholder="Field"
                className="form-input w-1/4 min-w-[120px]"
                value={cond.field}
                onChange={(e) => updateCondition(cond.id, "field", e.target.value)}
              />
              <select
                className="form-select w-1/6"
                value={cond.operator}
                onChange={(e) =>
                  updateCondition(cond.id, "operator", e.target.value)
                }
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Value"
                className="form-input w-1/4 min-w-[120px]"
                value={cond.value}
                onChange={(e) => updateCondition(cond.id, "value", e.target.value)}
              />
              <button
                className="btn btn-outline text-red-600"
                onClick={() => removeCondition(cond.id)}
                title="Remove Condition"
              >
                &times;
              </button>
            </div>
          ))}
          <button className="btn btn-primary mt-2" onClick={addCondition}>
            + Add Condition
          </button>
        </div>

        {/* Actions */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Actions</h4>
          {formActions.length === 0 && (
            <p className="text-gray-500 mb-2">No actions added yet.</p>
          )}
          {formActions.map((action) => (
            <div
              key={action.id}
              className="flex gap-2 items-center mb-2 flex-wrap"
            >
              <select
                className="form-select w-1/4 min-w-[150px]"
                value={action.type}
                onChange={(e) => updateAction(action.id, "type", e.target.value)}
              >
                {actionTypes.map((at) => (
                  <option key={at} value={at}>
                    {at}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Parameters (e.g. email address)"
                className="form-input flex-grow min-w-[150px]"
                value={action.params}
                onChange={(e) => updateAction(action.id, "params", e.target.value)}
              />
              <button
                className="btn btn-outline text-red-600"
                onClick={() => removeAction(action.id)}
                title="Remove Action"
              >
                &times;
              </button>
            </div>
          ))}
          <button className="btn btn-primary mt-2" onClick={addAction}>
            + Add Action
          </button>
        </div>

        <label className="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={formActive}
            onChange={(e) => setFormActive(e.target.checked)}
          />
          <span>Active</span>
        </label>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={handleSave}>
            {editingRule ? "Update Rule" : "Add Rule"}
          </button>
          <button className="btn btn-outline" onClick={resetForm}>
            Cancel
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div>
        {rules.length === 0 ? (
          <p className="text-center text-gray-500">No workflow rules created.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Trigger Event</th>
                <th className="px-4 py-2 text-left">Conditions</th>
                <th className="px-4 py-2 text-left">Actions</th>
                <th className="px-4 py-2 text-center">Active</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{rule.name}</td>
                  <td className="px-4 py-2">{rule.triggerEvent}</td>
                  <td className="px-4 py-2">
                    {rule.conditions
                      .map(
                        (c) =>
                          `${c.field} ${c.operator} "${c.value}"`
                      )
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2">
                    {rule.actions
                      .map((a) => `${a.type} (${a.params})`)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {rule.active ? (
                      <span className="text-green-600 font-semibold">Yes</span>
                    ) : (
                      <span className="text-red-600 font-semibold">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center space-x-2">
                    <button
                      className="btn btn-icon btn-sm text-blue-600 hover:text-blue-800"
                      onClick={() => handleEdit(rule)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-icon btn-sm text-red-600 hover:text-red-800"
                      onClick={() => handleDelete(rule.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AutomationWorkflowRules;
