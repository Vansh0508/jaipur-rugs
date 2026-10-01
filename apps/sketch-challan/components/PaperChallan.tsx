"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import type { ChallanDetailsPatch, SketchChallan } from "@/lib/domain/types";
import { SKETCH_CATEGORIES } from "@/lib/domain/types";
import { DEMO_SKETCHERS } from "@/lib/demoData";
import { shownChallanDate } from "@/lib/domain/assignments";
import { showMapFeet } from "@/lib/mapSizeRules";
import { todayInIndia } from "@/lib/domain/workdays";

const PARTS = ["Full sketch", "Border", "Bicha", "Central field", "Length", "Width", "Texture / colouring"];
const ink = "w-full min-w-0 border-0 border-b border-black/50 bg-transparent px-0 py-0.5 text-[12px] text-black outline-none";

function showDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${Number(match[3])}. ${months[Number(match[2]) - 1]} ${match[1]}`;
}

export function PaperChallan({
  row,
  mode = "view",
  onPatch,
  onAssign,
}: {
  row: SketchChallan;
  mode?: "view" | "edit" | "remarks";
  onPatch?: (patch: ChallanDetailsPatch, message: string) => void;
  onAssign?: (parts: { sketcherName: string; assignedPart: string }[]) => void;
}) {
  const canEdit = mode === "edit";
  const [sketcherName, setSketcherName] = useState(DEMO_SKETCHERS[0] ?? "Aditi Sharma");
  const [part, setPart] = useState(PARTS[0] ?? "Full sketch");
  const [staged, setStaged] = useState<{ sketcherName: string; assignedPart: string }[]>([]);
  const [assignNote, setAssignNote] = useState("");
  const set = (patch: ChallanDetailsPatch, message: string) => onPatch?.(patch, message);
  function addPart() {
    // Same person + same part twice is a mistake (the server refuses it too).
    const open = [...staged, ...row.tasks.filter((task) => task.status !== "completed")];
    if (open.some((item) => item.sketcherName === sketcherName && item.assignedPart === part)) {
      setAssignNote(`${sketcherName} already has ${part}.`);
      return;
    }
    setAssignNote("");
    setStaged((list) => [...list, { sketcherName, assignedPart: part }]);
  }
  const cell = "border border-black px-2 py-1.5";
  const pair = (label: string, control: React.ReactNode) => (
    <div className="grid grid-cols-[9.5rem_1fr] items-center gap-x-3 py-0.5">
      <span className="font-bold">{label}</span>
      {control}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <article className="bg-white p-6 text-[12px] leading-snug text-black shadow-sm ring-1 ring-black/10">
        <p className="text-center text-[13px] font-bold">Jaipur Rugs Company Limited</p>
        <p className="mb-5 text-center text-[13px] font-bold">Map Sketch Issue/Receive Challan</p>
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          <div>
            {pair("Prod. Order No", <span>{row.productionOrderNo}</span>)}
            {pair("Map No", <span>{row.mapNo ?? ""}</span>)}
            {pair("Size", <span>{row.orderSize ?? ""}</span>)}
            {pair("DraftsMan", <Ink value={row.draftsman} disabled={!canEdit} onChange={(value) => set({ draftsman: value }, "DraftsMan changed.")} />)}
            {pair("Challan Date", canEdit
              ? <Ink type="date" min={todayInIndia()} value={shownChallanDate(row)} onChange={(value) => set({ challanDate: value }, `Challan date set to ${value}.`)} />
              : <span>{showDate(shownChallanDate(row))}</span>)}
            {pair("Sketch Category", <Pick value={row.sketchCategory} options={[...SKETCH_CATEGORIES]} disabled={!canEdit} onChange={(value) => set({ sketchCategory: value }, `Category changed to ${value}.`)} />)}
            {pair("Type Of Size", <Ink value={row.sizeType} disabled={!canEdit} onChange={(value) => set({ sizeType: value }, "Type of size changed.")} />)}
            {pair("Developer", <Ink value={row.developer} disabled={!canEdit} onChange={(value) => set({ developer: value }, "Developer changed.")} />)}
            {pair("Order Count", <Ink type="number" value={String(row.orderCount)} disabled={!canEdit} onChange={(value) => set({ orderCount: Number(value) || 0 }, "Order count changed.")} />)}
          </div>
          <div>
            {pair("Design", <Ink value={row.design} disabled={!canEdit} onChange={(value) => set({ design: value }, "Design changed.")} />)}
            {pair("Ground", <Ink value={row.ground} disabled={!canEdit} onChange={(value) => set({ ground: value }, "Ground changed.")} />)}
            {pair("Border", <Ink value={row.border} disabled={!canEdit} onChange={(value) => set({ border: value }, "Border changed.")} />)}
            {pair("Matching Code", <Ink value={row.matchingCode} disabled={!canEdit} onChange={(value) => set({ matchingCode: value }, "Matching code changed.")} />)}
            {pair("Substitute Design", <Ink value={row.substituteDesign ?? ""} disabled={!canEdit} onChange={(value) => set({ substituteDesign: value }, "Substitute design changed.")} />)}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-center">
          <thead>
            <tr>
              {["Quality", "Shape", "Map Width", "Map Length", "Area", "Quantity"].map((heading) => (
                <th key={heading} className={cell + " font-bold"}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell}><Ink value={row.quality} disabled={!canEdit} onChange={(value) => set({ quality: value }, "Quality changed.")} /></td>
              <td className={cell}><Ink value={row.shape} disabled={!canEdit} onChange={(value) => set({ shape: value }, "Shape changed.")} /></td>
              <td className={cell}><Ink type="number" value={canEdit ? String(row.mapWidthFt) : showMapFeet(row.mapWidthFt, row.mapSizeWhole)} disabled={!canEdit} onChange={(value) => set({ mapWidthFt: Number(value) || 0 }, "Width changed.")} /></td>
              <td className={cell}><Ink type="number" value={canEdit ? String(row.mapLengthFt) : showMapFeet(row.mapLengthFt, row.mapSizeWhole)} disabled={!canEdit} onChange={(value) => set({ mapLengthFt: Number(value) || 0 }, "Length changed.")} /></td>
              <td className={cell}><Ink type="number" value={String(row.areaSqFt)} disabled={!canEdit} onChange={(value) => set({ areaSqFt: Number(value) || 0 }, "Area changed.")} /></td>
              <td className={cell}><Ink type="number" value={String(row.quantity)} disabled={!canEdit} onChange={(value) => set({ quantity: Number(value) || 0 }, "Quantity changed.")} /></td>
            </tr>
            <tr>
              <td className={cell + " text-left font-bold"}>Description:</td>
              <td className={cell + " text-left"} colSpan={5}><Ink value={row.description} disabled={!canEdit} onChange={(value) => set({ description: value }, "Description changed.")} /></td>
            </tr>
          </tbody>
        </table>
        </div>
        {row.mapSizeNote ? <p className="no-print mt-1 text-[11px] text-black/60">{row.mapSizeNote}</p> : null}
        <div className="mt-4 flex flex-col gap-2">
          {pair("Design Remarks:", <Ink value={row.managerRemark1} disabled={mode !== "edit"} onChange={(value) => set({ managerRemark1: value }, "Manager remark 1 changed.")} />)}
          {pair("Substitute Remarks:", <Ink value={row.managerRemark2} disabled={mode !== "edit"} onChange={(value) => set({ managerRemark2: value }, "Manager remark 2 changed.")} />)}
          {pair("Sketcher Remark:", <Ink value={row.sketcherRemark} disabled={mode !== "remarks"} onChange={(value) => set({ sketcherRemark: value }, "Sketcher remark changed.")} />)}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-4">
          <p>Due Date: {canEdit ? <Ink type="date" value={row.dueDate} onChange={(value) => set({ dueDate: value }, `Due date set to ${value}.`)} /> : showDate(row.dueDate)}</p>
          <p>Prepared By: {row.draftsman || ""}</p>
          <p>Received By/Date</p>
          <p>Checked By/Date</p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <p>Color Copy</p>
          <p>Master Creation</p>
          <p>Master Checking</p>
        </div>
      </article>
      {onAssign ? (
        <div className="no-print flex flex-col gap-2 rounded-2xl border border-border bg-surface-secondary p-4">
          <p className="text-sm font-medium">Assign / सौंपें</p>
          <div className="flex flex-wrap items-end gap-2">
            <Pick value={sketcherName} options={DEMO_SKETCHERS} onChange={setSketcherName} />
            <Pick value={part} options={PARTS} onChange={setPart} />
            <Button size="sm" variant="secondary" onPress={addPart}>Add part</Button>
          </div>
          {row.tasks.map((task) => (
            <p key={task.id} className="text-sm">{task.sketcherName} — {task.assignedPart}</p>
          ))}
          {staged.map((item, index) => (
            <p key={index} className="flex items-center gap-3 text-sm text-muted">
              {item.sketcherName} — {item.assignedPart} (not allotted yet)
              <button type="button" className="text-xs text-danger" onClick={() => setStaged((list) => list.filter((_, at) => at !== index))}>Remove</button>
            </p>
          ))}
          {assignNote ? <p className="text-sm text-danger">{assignNote}</p> : null}
          {staged.length ? (
            <div className="flex gap-2">
              <Button size="sm" onPress={() => { onAssign(staged); setStaged([]); }}>Allot {staged.length} part{staged.length === 1 ? "" : "s"}</Button>
              <Button size="sm" variant="secondary" onPress={() => setStaged([])}>Clear</Button>
            </div>
          ) : row.tasks.length === 0 ? <p className="text-sm text-muted">No one assigned. Add parts, then allot. After allotment, changes need admin approval.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// Saves when you leave the field (or press Enter), not on every keystroke: one save and one history line per edit.
function Ink({
  value, onChange, disabled, type = "text", min,
}: {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: string;
  min?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (disabled || !onChange) return <span>{value || ""}</span>;
  return (
    <input
      className={ink}
      type={type}
      min={min}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { if (draft !== null && draft !== value) onChange(draft); setDraft(null); }}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    />
  );
}

function Pick({
  value, options, onChange, disabled,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (disabled) return <span>{value || ""}</span>;
  return (
    <select className={ink} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}
