import {
  bulkDeleteContacts,
  createContact,
  deleteContact,
  getContact,
  importContacts,
  listContacts,
  updateContact,
} from "./contacts.service.js";
import { parseContactWorkbook } from "./contacts.workbook.js";
import XLSX from "xlsx";

export function downloadContactTemplate(_req, res, next) {
  try {
    const rows = [
      ["name", "phone", "email", "date_of_birth", "tags", "source", "status", "notes", "company", "city"],
      ["Ananya Sharma", "9876543210", "ananya@example.com", "1994-05-18", "Lead, VIP", "CSV Import", "active", "Interested in pricing", "Bright Retail", "Mumbai"],
      ["Rohan Mehta", "9123456780", "rohan@example.com", "1989-11-02", "Customer", "CSV Import", "active", "Existing buyer", "Mehta Traders", "Pune"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = rows[0].map((column) => ({ wch: Math.max(column.length + 2, 14) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=\"waflow-contact-import-format.xlsx\"", "Content-Length": buffer.length });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function getContacts(req, res, next) {
  try {
    res.json({ success: true, data: await listContacts(req.user._id, req.validated.query) });
  } catch (error) {
    next(error);
  }
}

export async function getContactById(req, res, next) {
  try {
    res.json({ success: true, data: { contact: await getContact(req.user._id, req.validated.params.id) } });
  } catch (error) {
    next(error);
  }
}

export async function postContact(req, res, next) {
  try {
    res.status(201).json({ success: true, data: { contact: await createContact(req.user._id, req.validated.body) } });
  } catch (error) {
    next(error);
  }
}

export async function postContactImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Choose a CSV, XLS or XLSX file to import" });
    }

    const rows = parseContactWorkbook(req.file.buffer, req.file.originalname);
    const result = await importContacts(req.user._id, rows);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function patchContact(req, res, next) {
  try {
    res.json({
      success: true,
      data: { contact: await updateContact(req.user._id, req.validated.params.id, req.validated.body) },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContactById(req, res, next) {
  try {
    await deleteContact(req.user._id, req.validated.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function deleteContactsBulk(req, res, next) {
  try {
    res.json({ success: true, data: await bulkDeleteContacts(req.user._id, req.validated.body.ids) });
  } catch (error) {
    next(error);
  }
}
