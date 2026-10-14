import XLSX from "xlsx";

import { ApiError } from "../../utils/apiError.js";

export function parseContactWorkbook(buffer, filename = "") {
  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: true,
    });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new ApiError(400, "The uploaded file has no sheets");
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: "",
      blankrows: false,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, `Unable to read ${filename || "contact file"}. Upload a valid CSV, XLS or XLSX file.`);
  }
}
