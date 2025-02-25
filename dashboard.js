/****************************************************
 * dashboard.js - Updated with PDF Export, Modal Gallery,
 * Date Formatting, Filtering, Sorting, Drag-and-Drop
 * Reordering, and Summary Rendering using Firestore
 ****************************************************/

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Global variable to store the current year
let currentYear = "2024";

// Helper: Format ISO date (YYYY-MM-DD) to DD/MM/YYYY
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

// 1. Switch years
function showYear(year) {
  currentYear = year;
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  displayDashboardCampaigns(year);
}
window.showYear = showYear;

// 2. Display campaigns for the selected year from Firestore
function displayDashboardCampaigns(year) {
  const dashboardTable = document.querySelector("#dashboardTable tbody");
  dashboardTable.innerHTML = "";

  // Query Firestore for campaigns where "year" equals the selected year
  const q = query(collection(window.db, "campaigns"), where("year", "==", year));
  
  // Listen for real-time updates
  onSnapshot(q, (snapshot) => {
    dashboardTable.innerHTML = "";
    const campaigns = [];
    
    snapshot.forEach((docSnap) => {
      let campaign = docSnap.data();
      campaign.id = docSnap.id; // assign Firestore document ID
      campaigns.push(campaign);
      
      // Create table row for each campaign
      const row = dashboardTable.insertRow();
      row.setAttribute("data-id", campaign.id);
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

    if (campaigns.length === 0) {
      dashboardTable.innerHTML =
        "<tr><td colspan='9'>No campaigns available for this year.</td></tr>";
      document.getElementById("summaryContent").textContent =
        "No campaigns for this year.";
    } else {
      // Re-apply filters (brand + month) after loading
      filterCampaigns();
      // Compute how often each brand appeared by quarter and update summary
      const appearances = computeBrandAppearances(campaigns);
      displaySummary(appearances, year);
    }
  });
}

// 3. Updated openImage function to open a modal gallery without a caption
function openImage(url) {
  const modal = document.getElementById("imageModal");
  const fullImage = document.getElementById("fullImage");
  fullImage.src = url;
  document.getElementById("imageCaption").textContent = "";
  modal.style.display = "block";
}
window.openImage = openImage;

// 4. Set up event listeners for filters, modal functionality, and column sorting
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

  // Modal close: close modal when clicking on the close button
  const modalClose = document.querySelector(".modal .close");
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      document.getElementById("imageModal").style.display = "none";
    });
  }
  // Also close modal if clicking outside the modal content
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("imageModal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Set up column sorting by attaching click listeners to table headers
  const headers = document.querySelectorAll("#dashboardTable thead th");
  headers.forEach((header, index) => {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      sortTableByColumn(index);
    });
  });
});

// 5. Combined filter function for brand and month
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

// 6. Column Sorting: Sort table rows by header column
const sortDirections = {}; // To store sort direction for each column
function sortTableByColumn(columnIndex) {
  const table = document.getElementById("dashboardTable");
  const tbody = table.querySelector("tbody");
  let rows = Array.from(tbody.querySelectorAll("tr"));

  // Toggle sort direction for this column
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

  // Rebuild tbody with sorted rows
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}

// 7. Default year on window load
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

// Render the summary as a neat table (without bullet points)
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
   9. Drag-and-Drop Reordering Update Function
   ------------------------------------------------------------ */

// Update the order of campaigns in Firestore based on new order from drag-and-drop
// NOTE: For full persistence, each campaign document should include an "order" field.
// This function currently logs the new order and should be extended to update Firestore.
function updateDashboardOrder(newOrder) {
  console.log("New order received:", newOrder);
  // Example: Iterate over newOrder (array of campaign IDs) and update each document's order field.
  // newOrder.forEach((id, index) => {
  //   updateDoc(doc(window.db, "campaigns", id), { order: index });
  // });
}
