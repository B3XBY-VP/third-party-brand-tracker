/****************************************************
 * dashboard.js - Firestore Version with PDF Export,
 * Modal Gallery, Date Formatting, Filtering, Sorting,
 * Drag-and-Drop Reordering, and Summary Rendering
 ****************************************************/

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from "./firebaseSync.js";

// We'll keep all campaigns in this array (for the current year)
let campaigns = [];

// Keep track of the currently displayed year
let currentYear = "2024";

// Helper: Format ISO date (YYYY-MM-DD) to DD/MM/YYYY
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

/*
  1. Switch years
  Sets up a real-time listener on `campaigns_{year}` to automatically refresh
  the table whenever data changes in Firestore.
*/
function showYear(year) {
  currentYear = year;
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  watchDashboardCampaigns(year);
}

/*
  watchDashboardCampaigns(year):
  Attaches an onSnapshot listener to Firestore so data is updated in real time.
  Optionally, if you want to always sort by an "orderIndex" field, you can do:
     const colRef = query(collection(db, `campaigns_${year}`), orderBy("orderIndex", "asc"));
*/
function watchDashboardCampaigns(year) {
  const colRef = collection(db, `campaigns_${year}`);
  // If you want a default sort by a field, do:
  // const colRef = query(collection(db, `campaigns_${year}`), orderBy("orderIndex"));

  onSnapshot(colRef, (snapshot) => {
    // Rebuild campaigns from Firestore
    campaigns = snapshot.docs.map((docSnap) => {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    });
    // Display them
    displayDashboardCampaigns();
  });
}

/*
  2. Display campaigns for the currently selected year (stored in `campaigns`).
  This replaces the old localStorage-based approach.
*/
function displayDashboardCampaigns() {
  const dashboardTable = document.querySelector("#dashboardTable tbody");
  dashboardTable.innerHTML = "";

  if (!campaigns || campaigns.length === 0) {
    dashboardTable.innerHTML =
      "<tr><td colspan='9'>No campaigns available for this year.</td></tr>";
    document.getElementById("summaryContent").textContent =
      "No campaigns for this year.";
    return;
  }

  // Populate table rows
  campaigns.forEach((campaign, index) => {
    const row = dashboardTable.insertRow();
    // If you have an `orderIndex` in Firestore, use that; else fallback to index
    const rowId = campaign.id || index;
    row.setAttribute("data-id", rowId);
    // Attach data-brand and data-month for filtering
    row.setAttribute("data-brand", campaign.brand || "");
    row.setAttribute("data-month", campaign.saleMonth || "");

    row.innerHTML = `
      <td>${campaign.brand || ""}</td>
      <td>${campaign.saleMonth || ""}</td>
      <td>${campaign.campaignName || ""}</td>
      <td>${campaign.campaignType || ""}</td>
      <td>${campaign.pageLocation || ""}</td>
      <td>${formatDateToDMY(campaign.startDate)}</td>
      <td>${formatDateToDMY(campaign.endDate)}</td>
      <td>${campaign.engagementNotes || ""}</td>
      <td>
        ${
          campaign.imageUrl
            ? `<div class="campaign-image-container">
                 <img src="${campaign.imageUrl}" width="50"
                      onclick="openImage('${campaign.imageUrl}')"
                      alt="Campaign Image">
                 <br>
                 <a href="${campaign.imageUrl}"
                    download="campaign-image.png"
                    class="download-btn">&#x2193;</a>
               </div>`
            : "No Image"
        }
      </td>
    `;
  });

  // Re-apply brand/month filters
  filterCampaigns();

  // Compute brand appearances by quarter and update summary
  const appearances = computeBrandAppearances(campaigns);
  displaySummary(appearances, currentYear);
}

/*
  3. Updated openImage function - opens the modal gallery
*/
function openImage(url) {
  const modal = document.getElementById("imageModal");
  const fullImage = document.getElementById("fullImage");
  fullImage.src = url;
  document.getElementById("imageCaption").textContent = "";
  modal.style.display = "block";
}

/*
  4. On DOMContentLoaded, set up brand/month filters, modal close, column sorting
*/
document.addEventListener("DOMContentLoaded", () => {
  // BRAND filters
  const brandCheckboxes = document.querySelectorAll('input[name="brandFilter"]');
  const clearBrandsBtn = document.getElementById("clearAllBrands");
  brandCheckboxes.forEach((cb) => {
    cb.addEventListener("change", filterCampaigns);
  });
  if (clearBrandsBtn) {
    clearBrandsBtn.addEventListener("click", () => {
      brandCheckboxes.forEach((cb) => (cb.checked = false));
      filterCampaigns();
    });
  }

  // MONTH filters
  const monthCheckboxes = document.querySelectorAll('input[name="monthFilter"]');
  const clearMonthsBtn = document.getElementById("clearAllMonths");
  monthCheckboxes.forEach((cb) => {
    cb.addEventListener("change", filterCampaigns);
  });
  if (clearMonthsBtn) {
    clearMonthsBtn.addEventListener("click", () => {
      monthCheckboxes.forEach((cb) => (cb.checked = false));
      filterCampaigns();
    });
  }

  // Modal close handlers
  const modalClose = document.querySelector(".modal .close");
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      document.getElementById("imageModal").style.display = "none";
    });
  }
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("imageModal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Column sorting
  const headers = document.querySelectorAll("#dashboardTable thead th");
  headers.forEach((header, index) => {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      sortTableByColumn(index);
    });
  });
});

/*
  5. Combined filter function for brand and month
*/
function filterCampaigns() {
  const brandCheckboxes = document.querySelectorAll('input[name="brandFilter"]');
  const checkedBrands = Array.from(brandCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const monthCheckboxes = document.querySelectorAll('input[name="monthFilter"]');
  const checkedMonths = Array.from(monthCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const rows = document.querySelectorAll("#dashboardTable tbody tr");
  rows.forEach((row) => {
    const rowBrand = row.getAttribute("data-brand") || "";
    const rowMonth = row.getAttribute("data-month") || "";
    const passBrand =
      checkedBrands.length === 0 || checkedBrands.includes(rowBrand);
    const passMonth =
      checkedMonths.length === 0 || checkedMonths.includes(rowMonth);
    row.style.display = passBrand && passMonth ? "" : "none";
  });
}

/*
  6. Column Sorting
*/
const sortDirections = {}; // Track current direction per column
function sortTableByColumn(columnIndex) {
  const table = document.getElementById("dashboardTable");
  const tbody = table.querySelector("tbody");
  let rows = Array.from(tbody.querySelectorAll("tr"));

  // Toggle sort direction
  const currentDir = sortDirections[columnIndex] || "asc";
  const newDir = currentDir === "asc" ? "desc" : "asc";
  sortDirections[columnIndex] = newDir;

  rows.sort((a, b) => {
    const cellA = a.cells[columnIndex].innerText.toLowerCase();
    const cellB = b.cells[columnIndex].innerText.toLowerCase();
    if (cellA < cellB) return newDir === "asc" ? -1 : 1;
    if (cellA > cellB) return newDir === "asc" ? 1 : -1;
    return 0;
  });

  // Rebuild table body with sorted rows
  tbody.innerHTML = "";
  rows.forEach((row) => tbody.appendChild(row));
}

/*
  7. Default year on window load
*/
window.onload = function () {
  showYear("2024");
};

/* ------------------------------------------------------------
   8. QUARTER COUNTING + SUMMARY RENDERING
------------------------------------------------------------ */

// Convert month to quarter (Q1, Q2, Q3, Q4)
function getQuarterFromMonth(monthName) {
  const month = (monthName || "").toLowerCase();
  if (["january", "february", "march"].includes(month)) return "Q1";
  if (["april", "may", "june"].includes(month)) return "Q2";
  if (["july", "august", "september"].includes(month)) return "Q3";
  if (["october", "november", "december"].includes(month)) return "Q4";
  return null;
}

// Tally brand appearances by quarter
function computeBrandAppearances(campaigns) {
  const brandQuarterCounts = {};
  campaigns.forEach((campaign) => {
    const brand = campaign.brand || "Unknown";
    const quarter = getQuarterFromMonth(campaign.saleMonth);
    if (!brandQuarterCounts[brand]) {
      brandQuarterCounts[brand] = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    }
    if (quarter) {
      brandQuarterCounts[brand][quarter]++;
    }
  });
  return brandQuarterCounts;
}

// Render summary table
function displaySummary(appearances, year) {
  const summaryContent = document.getElementById("summaryContent");
  if (!appearances || Object.keys(appearances).length === 0) {
    summaryContent.innerHTML = "No brand data available.";
    return;
  }
  let html = `<p>Brand appearances for ${year} (by quarter):</p>`;
  html += `
    <table id="summaryTable" style="border-collapse: collapse; margin: 0 auto;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 6px;">Brand</th>
          <th style="border: 1px solid #ddd; padding: 6px;">Q1</th>
          <th style="border: 1px solid #ddd; padding: 6px;">Q2</th>
          <th style="border: 1px solid #ddd; padding: 6px;">Q3</th>
          <th style="border: 1px solid #ddd; padding: 6px;">Q4</th>
          <th style="border: 1px solid #ddd; padding: 6px;">Total</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (const brand in appearances) {
    const { Q1, Q2, Q3, Q4 } = appearances[brand];
    const total = Q1 + Q2 + Q3 + Q4;
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;"><strong>${brand}</strong></td>
        <td style="border: 1px solid #ddd; padding: 6px;">${Q1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${Q2}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${Q3}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${Q4}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${total}</td>
      </tr>
    `;
  }
  html += `
      </tbody>
    </table>
  `;
  summaryContent.innerHTML = html;
}

/* ------------------------------------------------------------
   9. Drag-and-Drop Reordering
   ------------------------------------------------------------ 
   If you want to store the new order in Firestore, add an 
   "orderIndex" field to each doc. 
*/

// Example drag-and-drop update function
async function updateDashboardOrder(newOrder) {
  // Here, you'd iterate over newOrder and update each doc's `orderIndex`.
  // For example:
  /*
     newOrder.forEach(async (docId, idx) => {
       const docRef = doc(db, `campaigns_${currentYear}`, docId);
       await updateDoc(docRef, { orderIndex: idx });
     });
  */
  // Then Firestore onSnapshot will deliver the updated sorting.
  // If you only want local re-sorting, just reorder `campaigns` in memory.

  console.log("New order of entries:", newOrder);
  // For local-only reorder: you could reorder `campaigns` in memory and call displayDashboardCampaigns().
}

// Expose functions for inline calls
window.showYear = showYear;
window.openImage = openImage;
window.updateDashboardOrder = updateDashboardOrder;
