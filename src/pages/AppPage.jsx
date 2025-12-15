import React, { useEffect, useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// -------------------------------
// HELPER: Parse table_details JSON & calculate total
// -------------------------------
const parseDetailsAndTotal = (details) => {
  if (!details) return { text: "N/A", total: 0 };

  let parsed;
  try {
    parsed = typeof details === "string" ? JSON.parse(details) : details;
  } catch {
    parsed = details;
  }

  let total = 0;
  let text = "";

  const processObject = (obj) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (key.toLowerCase().includes("price") || key.toLowerCase().includes("total")) {
        total += Number(value) || 0;
      }
      text += `${key.replace(/_/g, " ")}: ${value}\n`;
    });
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((section) => {
      if (typeof section === "object") processObject(section);
      else text += `${section}\n`;
    });
  } else if (typeof parsed === "object") {
    processObject(parsed);
  } else {
    text = String(parsed);
  }

  return { text: text.trim(), total };
};

export default function AppPage() {
  const [appRequests, setAppRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -------------------------------
  // FETCH APP REQUESTS
  // -------------------------------
  useEffect(() => {
    const fetchAppRequests = async () => {
      try {
        const res = await axios.get("https://app.aspireths.com/api/app-quotations");
        setAppRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Axios fetch error:", err);
        setError("Failed to fetch app requests. Make sure backend is running on port 5000.");
      } finally {
        setLoading(false);
      }
    };

    fetchAppRequests();
  }, []);

  // -------------------------------
  // CALCULATE GRAND TOTAL FOR ALL REQUESTS
  // -------------------------------
  const calculateGrandTotal = () =>
    appRequests.reduce((sum, req) => sum + parseDetailsAndTotal(req.table_details).total, 0);

  // -------------------------------
  // DOWNLOAD EXCEL
  // -------------------------------
  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("App Requests");

    sheet.columns = [
      { header: "Name", key: "customer_name", width: 20 },
      { header: "Email", key: "customer_email", width: 25 },
      { header: "Phone", key: "customer_phone", width: 15 },
      { header: "Message", key: "message", width: 30 },
      { header: "Grand Total (₹)", key: "grand_total", width: 15 },
      { header: "Table Details", key: "table_details", width: 50 },
      { header: "Created At", key: "created_at", width: 22 },
    ];

    // Header styling
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F81BD" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    // Add rows
    appRequests.forEach((req) => {
      const { text, total } = parseDetailsAndTotal(req.table_details);
      const row = sheet.addRow({
        customer_name: req.customer_name,
        customer_email: req.customer_email,
        customer_phone: req.customer_phone,
        message: req.message || "-",
        grand_total: total,
        table_details: text,
        created_at: req.created_at ? new Date(req.created_at).toLocaleString() : "N/A",
      });

      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        cell.alignment = { wrapText: true, vertical: "top" };
      });
    });

    // Add grand total row
    const totalRow = sheet.addRow([
      "Grand Total",
      "",
      "",
      "",
      calculateGrandTotal(),
      "",
      "",
    ]);
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      if (colNumber === 5) cell.numFmt = "₹#,##0.00";
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "app_requests.xlsx");
  };

  if (loading) return <p>Loading app requests...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!appRequests.length) return <p>No app requests found.</p>;

  return (
    <div className="app-page" style={{ padding: "20px" }}>
      <h2>App Requests Dashboard</h2>

      <button
        className="download-btn"
        onClick={downloadExcel}
        style={{ marginBottom: "20px", padding: "8px 16px", cursor: "pointer" }}
      >
        Download Excel 📥
      </button>

      <div className="table-responsive" style={{ overflowX: "auto" }}>
        <table
          border={1}
          cellPadding={5}
          style={{ borderCollapse: "collapse", width: "100%", minWidth: "800px" }}
        >
          <thead>
            <tr style={{ backgroundColor: "#4F81BD", color: "#fff" }}>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Message</th>
              <th>Grand Total</th>
              <th>Table Details</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
    {appRequests.map((req) => {
  // Parse table_details JSON safely
  let details = [];
  try {
    const parsed = typeof req.table_details === "string"
      ? JSON.parse(req.table_details)
      : req.table_details;

    // Ensure it's an array
    details = Array.isArray(parsed) ? parsed : [];
  } catch {
    details = [];
  }

  // Build text for table_details without prices
  const text = details
    .map((section) => {
      const selectedNames = section.selected && section.selected.length > 0
        ? section.selected.map((item) => item.name).join(", ")
        : "";
      return `${section.name}: ${selectedNames}`;
    })
    .join("\n");

  // Calculate total price for this request
  const total = details.reduce((acc, section) => acc + (section.totalPrice || 0), 0);

  return (
    <tr key={req.id}>
      <td>{req.customer_name}</td>
      <td>{req.customer_email}</td>
      <td>{req.customer_phone}</td>
      <td>{req.message || "N/A"}</td>
      <td>₹{total.toFixed(2)}</td>
      <td>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: "150px", overflowY: "auto" }} title={text}>
          {text}
        </pre>
      </td>
      <td>{req.created_at ? new Date(req.created_at).toLocaleString() : "N/A"}</td>
    </tr>
  );
})}


            {/* GRAND TOTAL ROW */}
            <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
              <td>Grand Total</td>
              <td colSpan={3}></td>
              <td>₹{calculateGrandTotal().toFixed(2)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

