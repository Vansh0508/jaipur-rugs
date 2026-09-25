import * as XLSX from "xlsx";

/** Builds and downloads a starter workbook for the bulk-upload modal — the exact headers
 * parseEmployeeFile.ts recognizes, plus one filled example row so the expected shape (a
 * department/role *name*, a manager's *email*, not raw ids) is obvious without reading
 * documentation. Same `json_to_sheet` → `writeFile` shape as
 * apps/atlas/lib/exportToExcel.ts uses for its exports, kept Hub-local since only Hub
 * needs a bulk-upload template today. */
export function downloadEmployeeTemplate() {
  const rows = [
    {
      full_name: "Jane Doe",
      email: "jane.doe@example.com",
      department: "Operations",
      manager_email: "manager@example.com",
      role: "Associate",
      employment_type: "full_time",
      employee_code: "",
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
  XLSX.writeFile(workbook, "employee-upload-template.xlsx");
}
