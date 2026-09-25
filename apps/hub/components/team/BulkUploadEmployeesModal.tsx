"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@heroui/react";
import { Button, Modal, Select } from "@jaipur-rugs/ui-kit";
import { bulkUploadEmployees, type BulkUploadEmployeeResult } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";
import type { TeamDirectoryRow } from "@/lib/queries/employees";
import { parseEmployeeFile, type ParsedEmployeeRow, type ParsedSheet } from "@/lib/bulkUpload/parseEmployeeFile";
import { resolveRows, type DedupKey, type ResolvedRow } from "@/lib/bulkUpload/resolveRows";
import { downloadEmployeeTemplate } from "@/lib/bulkUpload/downloadTemplate";
import {
  TARGET_FIELDS,
  emptyMapping,
  suggestMapping,
  applyMapping,
  sampleValueFor,
  type FieldMapping,
  type TargetFieldKey,
} from "@/lib/bulkUpload/fieldMapping";

type Step = "upload" | "mapping" | "preview" | "result";
type DuplicateAction = "ignore" | "overwrite";

const DEDUP_KEY_OPTIONS = [
  { id: "email", label: "Email" },
  { id: "employee_code", label: "Employee Code" },
] as const;

const DUPLICATE_ACTION_OPTIONS = [
  { id: "ignore", label: "Ignore — leave the existing employee untouched" },
  { id: "overwrite", label: "Overwrite — update department, manager, role & employment type" },
] as const;

const NOT_MAPPED = "__none__";

const PREVIEW_BADGE: Record<ResolvedRow["action"]["kind"], { label: string; color: "success" | "warning" | "default" | "danger" }> = {
  create: { label: "New", color: "success" },
  update: { label: "Update", color: "warning" },
  skip: { label: "Skip (existing)", color: "default" },
  error: { label: "Error", color: "danger" },
};

function resultBadge(result: BulkUploadEmployeeResult): { label: string; color: "success" | "warning" | "default" | "danger" } {
  switch (result.action) {
    case "created":
      return { label: "Created", color: "success" };
    case "updated":
      return { label: "Updated", color: "warning" };
    case "skipped":
      return { label: "Skipped", color: "default" };
    case "failed":
      return { label: `Failed: ${result.error ?? "unknown error"}`, color: "danger" };
  }
}

export function BulkUploadEmployeesModal({
  isOpen,
  onClose,
  departments,
  roles,
  directory,
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  directory: TeamDirectoryRow[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(emptyMapping());
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [dedupKey, setDedupKey] = useState<DedupKey>("email");
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("ignore");
  const [resolvedRows, setResolvedRows] = useState<ResolvedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<Map<number, BulkUploadEmployeeResult> | null>(null);

  const overwriteExisting = duplicateAction === "overwrite";

  function reset() {
    setStep("upload");
    setFile(null);
    setSheet(null);
    setMapping(emptyMapping());
    setParsedRows([]);
    setDedupKey("email");
    setDuplicateAction("ignore");
    setResolvedRows([]);
    setParseError(null);
    setSubmitError(null);
    setResults(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const summary = useMemo(() => {
    const counts = { create: 0, update: 0, skip: 0, error: 0 };
    for (const row of resolvedRows) counts[row.action.kind] += 1;
    return counts;
  }, [resolvedRows]);

  const sendableRows = useMemo(() => resolvedRows.filter((row) => row.payload), [resolvedRows]);

  async function handleReadFile() {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const parsedSheet = await parseEmployeeFile(file);
      if (parsedSheet.rows.length === 0) {
        setParseError("No rows were found in this file — check it has a header row and at least one data row.");
        return;
      }
      setSheet(parsedSheet);
      setMapping(suggestMapping(parsedSheet.headers));
      setStep("mapping");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read this file — make sure it's a valid .csv or .xlsx file.");
    } finally {
      setParsing(false);
    }
  }

  function handleMappingChange(field: TargetFieldKey, sourceHeader: string) {
    setMapping((prev) => ({ ...prev, [field]: sourceHeader === NOT_MAPPED ? null : sourceHeader }));
  }

  function handleContinueFromMapping() {
    if (!sheet) return;
    const mapped = applyMapping(sheet.rows, mapping);
    setParsedRows(mapped);
    setResolvedRows(resolveRows({ parsedRows: mapped, departments, roles, directory, dedupKey, overwriteExisting }));
    setStep("preview");
  }

  // resolveRows is a pure function of its inputs, so flipping Ignore/Overwrite here just
  // re-derives every row's action against the same mapped data — no re-parsing needed.
  function handleDuplicateActionChange(next: DuplicateAction) {
    setDuplicateAction(next);
    if (parsedRows.length > 0) {
      setResolvedRows(
        resolveRows({ parsedRows, departments, roles, directory, dedupKey, overwriteExisting: next === "overwrite" }),
      );
    }
  }

  async function handleConfirm() {
    if (sendableRows.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await bulkUploadEmployees(getBrowserSupabaseClient(), {
        dedupKey,
        overwriteExisting,
        rows: sendableRows.map((row) => row.payload!),
      });
      const byRowNumber = new Map<number, BulkUploadEmployeeResult>();
      response.results.forEach((result) => {
        const sentRow = sendableRows[result.index];
        if (sentRow) byRowNumber.set(sentRow.rowNumber, result);
      });
      setResults(byRowNumber);
      setStep("result");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not complete the bulk upload. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const showTable = step === "preview" || step === "result";
  const headerOptions = (sheet?.headers ?? []).map((header) => ({ id: header, label: header }));

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[760px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {step === "upload"
                  ? "Bulk upload employees"
                  : step === "mapping"
                    ? "Match your columns"
                    : step === "preview"
                      ? "Review before uploading"
                      : "Upload result"}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              {step === "upload" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Spreadsheet (.csv or .xlsx)</label>
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border/40"
                    />
                    <button
                      type="button"
                      onClick={downloadEmployeeTemplate}
                      className="self-start text-xs font-medium text-accent hover:underline"
                    >
                      Download a template
                    </button>
                  </div>
                  <Select
                    label="Match existing employees by"
                    items={DEDUP_KEY_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                    value={dedupKey}
                    onChange={(value) => value && setDedupKey(value as DedupKey)}
                    isRequired
                    fullWidth
                  />
                  <Select
                    label="If a row matches an existing employee"
                    items={DUPLICATE_ACTION_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                    value={duplicateAction}
                    onChange={(value) => value && setDuplicateAction(value as DuplicateAction)}
                    isRequired
                    fullWidth
                  />
                  {parseError ? <p className="text-sm text-danger">{parseError}</p> : null}
                </>
              ) : null}

              {step === "mapping" ? (
                <>
                  <p className="text-sm text-muted">
                    Tell us which column in your file is which. Nothing here is required — leave anything that doesn't apply
                    as "Not mapped".
                  </p>
                  <div className="flex flex-col gap-3">
                    {TARGET_FIELDS.map((field) => {
                      const sample = sampleValueFor(sheet?.rows ?? [], mapping[field.key]);
                      return (
                        <div key={field.key} className="flex flex-col gap-1">
                          <Select
                            label={field.label}
                            items={[{ id: NOT_MAPPED, label: "Not mapped" }, ...headerOptions]}
                            value={mapping[field.key] ?? NOT_MAPPED}
                            onChange={(value) => value && handleMappingChange(field.key, value)}
                            fullWidth
                          />
                          {sample ? <p className="text-xs text-muted">e.g. {sample}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {step === "preview" ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-muted">
                    {summary.create} new · {summary.update} to update · {summary.skip} to skip · {summary.error} with errors
                  </p>
                  <Select
                    label="If a row matches an existing employee"
                    items={DUPLICATE_ACTION_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                    value={duplicateAction}
                    onChange={(value) => value && handleDuplicateActionChange(value as DuplicateAction)}
                    isRequired
                    fullWidth
                  />
                </div>
              ) : null}

              {step === "result" ? (
                <p className="text-sm text-muted">
                  Processed {sendableRows.length} row{sendableRows.length === 1 ? "" : "s"}. Rows skipped or left as errors during
                  review were never sent.
                </p>
              ) : null}

              {showTable ? (
                <div className="max-h-[360px] overflow-auto rounded-xl border-2 border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b-2 border-border text-xs uppercase text-muted">
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Name / Email</th>
                        <th className="px-3 py-2 font-medium">Department</th>
                        <th className="px-3 py-2 font-medium">Manager</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedRows.map((row) => {
                        const serverResult = step === "result" ? results?.get(row.rowNumber) : undefined;
                        const badge = serverResult ? resultBadge(serverResult) : PREVIEW_BADGE[row.action.kind];
                        return (
                          <tr key={row.rowNumber} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-muted">{row.rowNumber}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-foreground">{row.fullName || "—"}</div>
                              <div className="text-xs text-muted">{row.email || "—"}</div>
                            </td>
                            <td className="px-3 py-2">{row.departmentName ?? "—"}</td>
                            <td className="px-3 py-2">{row.managerLabel ?? "—"}</td>
                            <td className="px-3 py-2">{row.roleLabel ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Chip color={badge.color} size="sm">
                                <Chip.Label>{badge.label}</Chip.Label>
                              </Chip>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            </Modal.Body>

            <Modal.Footer>
              {step === "upload" ? (
                <Button onPress={handleReadFile} isPending={parsing} isDisabled={!file} fullWidth>
                  Next: match columns
                </Button>
              ) : null}
              {step === "mapping" ? (
                <div className="flex w-full gap-2">
                  <Button variant="tertiary" onPress={() => setStep("upload")} className="flex-1">
                    Back
                  </Button>
                  <Button onPress={handleContinueFromMapping} className="flex-1">
                    Continue
                  </Button>
                </div>
              ) : null}
              {step === "preview" ? (
                <div className="flex w-full gap-2">
                  <Button variant="tertiary" onPress={() => setStep("mapping")} className="flex-1">
                    Back
                  </Button>
                  <Button onPress={handleConfirm} isPending={submitting} isDisabled={sendableRows.length === 0} className="flex-1">
                    Confirm upload ({sendableRows.length})
                  </Button>
                </div>
              ) : null}
              {step === "result" ? (
                <Button onPress={handleClose} fullWidth>
                  Done
                </Button>
              ) : null}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
