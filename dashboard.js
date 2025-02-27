
/****************************************************
 * dashboard.js - Firestore Version with PDF Export,
 * Modal Gallery, Date Formatting, Filtering, Sorting,
 * Search, Pagination, Drag-and-Drop Reordering,
 * Summary Rendering, and Error Handling / Loading Spinner
 ****************************************************/

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from "./firebaseSync.js";

// In-memory array of all campaigns for the current year
let campaigns = [];
// Keep track of the currently displayed year
let currentYear = "2025";

// If you want to show a loading spinner until the first Firestore snapshot arrives
let isFirstLoad = true;

// SEARCH + PAGINATION
let searchKeyword = "";   // text to search brand or campaignName
let currentPage = 1;      // current page for pagination
const pageSize = 10;      // how many items per page

/* 
  Helper: Format ISO date (YYYY-MM-DD) -> DD/MM/YYYY
*/
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

/* 
  1. showYear(year):
  Sets up a real-time listener on `campaigns_{year}`.
  We'll display a loading spinner until the first snapshot arrives.
*/
function showYear(year) {
  currentYear = year;
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  isFirstLoad = true;
  showLoadingModal();
  watchDashboardCampaigns(year);
}

/* 
  watchDashboardCampaigns(year):
  Attaches onSnapshot to Firestore so data is updated in real time.
*/
function watchDashboardCampaigns(year) {
  // If you have an orderIndex field in your docs, you can do:
  // const colRef = query(collection(db, `campaigns_${year}`), orderBy("orderIndex", "asc"));
  const colRef = collection(db, `campaigns_${year}`);

  onSnapshot(colRef, (snapshot) => {
    try {
      campaigns = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      displayDashboardCampaigns();
      if (isFirstLoad) {
        hideLoadingModal();
        isFirstLoad = false;
      }
    } catch (error) {
      console.error("Error reading dashboard data:", error);
      showErrorToast("Failed to load campaigns. Please try again.");
      hideLoadingModal();
    }
  }, (err) => {
    // Error callback
    console.error("onSnapshot error:", err);
    showErrorToast("Firestore error: " + err.message);
    hideLoadingModal();
  });
}

/* 
  2. displayDashboardCampaigns
  Renders the campaigns array into #dashboardTable,
  applying search + pagination + brand/month filters.
  (Now includes a Version History button for each row.)
*/
function displayDashboardCampaigns() {
  const dashboardTableBody = document.querySelector("#dashboardTable tbody");
  dashboardTableBody.innerHTML = "";

  // A) Apply search filter
  let filtered = campaigns;
  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    filtered = filtered.filter(c => {
      const brandMatch = c.brand && c.brand.toLowerCase().includes(kw);
      const nameMatch = c.campaignName && c.campaignName.toLowerCase().includes(kw);
      return brandMatch || nameMatch;
    });
  }

  // B) Pagination
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  // If pageItems is empty after filters, show a placeholder row
  if (pageItems.length === 0) {
    dashboardTableBody.innerHTML = `<tr><td colspan='10'>No campaigns match your criteria.</td></tr>`;
    document.getElementById("summaryContent").textContent = "No campaigns for this query.";
    updatePaginationInfo(totalItems, totalPages);
    return;
  }

  // Render the pageItems with an extra column for Version History
  pageItems.forEach((campaign, index) => {
    const row = dashboardTableBody.insertRow();
    // For drag-and-drop, use the doc ID or fallback index
    const rowId = campaign.id || (startIndex + index);
    row.setAttribute("data-id", rowId);
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
      <td>
        <button onclick="openVersionHistory('${campaign.id}')">View History</button>
      </td>
    `;
  });

  // Re-apply brand/month filters (on the rendered rows)
  filterCampaigns(); 

  // Summary for the entire filtered array, not just pageItems
  const appearances = computeBrandAppearances(filtered);
  displaySummary(appearances, currentYear);

  // Update pagination UI
  updatePaginationInfo(totalItems, totalPages);
}

/* 
  3. openImage(url):
  Opens the modal gallery to view an image
*/
function openImage(url) {
  const modal = document.getElementById("imageModal");
  const fullImage = document.getElementById("fullImage");
  fullImage.src = url;
  document.getElementById("imageCaption").textContent = "";
  modal.style.display = "block";
}

/* 
  4. openVersionHistory(campaignId):
  Fetches and displays the edit history for the given campaign.
  Both admins and viewers can see the history. If the user is an admin,
  a Restore button will be shown for each version entry.
*/
async function openVersionHistory(campaignId) {
  try {
    const docRef = doc(db, `campaigns_${currentYear}`, campaignId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const history = docSnap.data().editHistory || [];
      // Sort history by timestamp (newest first)
      history.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.seconds - a.timestamp.seconds;
      });
      
      let html = "";
      if (history.length === 0) {
        html = "No edit history available.";
      } else {
        history.forEach(entry => {
          const date = entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleString() : "Unknown date";
          let changesHtml = "";
          if (entry.changes) {
            for (const key in entry.changes) {
              changesHtml += `<p><strong>${key}:</strong> ${entry.changes[key]}</p>`;
            }
          }
          html += `<div class="history-entry">
                    <p><strong>Editor:</strong> ${entry.editor || "Unknown"}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    ${changesHtml}
                    ${window.currentUserRole === "admin" ? `<button onclick="restoreVersion('${campaignId}', ${entry.timestamp.seconds})">Restore</button>` : ""}
                   </div><hr/>`;
        });
      }
      // Assume there's a modal with id "historyModal" and a container with id "historyContent"
      document.getElementById("historyContent").innerHTML = html;
      document.getElementById("historyModal").style.display = "block";
    } else {
      showErrorToast("Campaign not found.");
    }
  } catch (error) {
    console.error("Error loading version history:", error);
    showErrorToast("Failed to load version history. Please try again.");
  }
}
window.openVersionHistory = openVersionHistory;

/* 
  5. Set up brand/month filters, modal close, column sorting
*/
document.addEventListener("DOMContentLoaded", () => {
  // brand + month filters + sorting are already set below
  const brandCheckboxes = document.querySelectorAll('input[name="brandFilter"]');
  const clearBrandsBtn = document.getElementById("clearAllBrands");
  brandCheckboxes.forEach((cb) => cb.addEventListener("change", filterCampaigns));
  if (clearBrandsBtn) {
    clearBrandsBtn.addEventListener("click", () => {
      brandCheckboxes.forEach(cb => cb.checked = false);
      filterCampaigns();
    });
  }

  const monthCheckboxes = document.querySelectorAll('input[name="monthFilter"]');
  const clearMonthsBtn = document.getElementById("clearAllMonths");
  monthCheckboxes.forEach((cb) => cb.addEventListener("change", filterCampaigns));
  if (clearMonthsBtn) {
    clearMonthsBtn.addEventListener("click", () => {
      monthCheckboxes.forEach(cb => cb.checked = false);
      filterCampaigns();
    });
  }

  // Modal close for image and version history modals
  const modalCloseButtons = document.querySelectorAll(".modal .close");
  modalCloseButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.parentElement.parentElement.style.display = "none";
    });
  });
  window.addEventListener("click", (event) => {
    const imageModal = document.getElementById("imageModal");
    const historyModal = document.getElementById("historyModal");
    if (event.target === imageModal) {
      imageModal.style.display = "none";
    }
    if (event.target === historyModal) {
      historyModal.style.display = "none";
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
  6. setSearchKeyword(keyword):
  Stores the user's search text, resets to page 1, re-displays.
*/
function setSearchKeyword(keyword) {
  searchKeyword = keyword.toLowerCase();
  currentPage = 1; // reset to first page
  displayDashboardCampaigns();
}

/* 
  7. Pagination: prevPage(), nextPage(), updatePaginationInfo
*/
function nextPage() {
  currentPage++;
  displayDashboardCampaigns();
}
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    displayDashboardCampaigns();
  }
}
function updatePaginationInfo(totalItems, totalPages) {
  const pageInfo = document.getElementById("pageInfo");
  if (pageInfo) {
    pageInfo.innerText = `Page ${currentPage} of ${totalPages} (Total: ${totalItems})`;
  }
}

/* 
  8. filterCampaigns():
  Brand + Month filters on the already rendered table rows
*/
function filterCampaigns() {
  const brandCheckboxes = document.querySelectorAll('input[name="brandFilter"]');
  const checkedBrands = Array.from(brandCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

  const monthCheckboxes = document.querySelectorAll('input[name="monthFilter"]');
  const checkedMonths = Array.from(monthCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

  const rows = document.querySelectorAll("#dashboardTable tbody tr");
  rows.forEach(row => {
    const rowBrand = row.getAttribute("data-brand") || "";
    const rowMonth = row.getAttribute("data-month") || "";
    const passBrand = (checkedBrands.length === 0) || checkedBrands.includes(rowBrand);
    const passMonth = (checkedMonths.length === 0) || checkedMonths.includes(rowMonth);
    row.style.display = (passBrand && passMonth) ? "" : "none";
  });
}

/* 
  9. Column Sorting
*/
const sortDirections = {};
function sortTableByColumn(columnIndex) {
  const table = document.getElementById("dashboardTable");
  const tbody = table.querySelector("tbody");
  let rows = Array.from(tbody.querySelectorAll("tr"));

  const currentDir = sortDirections[columnIndex] || "asc";
  const newDir = (currentDir === "asc") ? "desc" : "asc";
  sortDirections[columnIndex] = newDir;

  rows.sort((a, b) => {
    const cellA = a.cells[columnIndex].innerText.toLowerCase();
    const cellB = b.cells[columnIndex].innerText.toLowerCase();
    if (cellA < cellB) return (newDir === "asc") ? -1 : 1;
    if (cellA > cellB) return (newDir === "asc") ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}

/* 
  10. Default year on window load
*/
window.onload = function() {
  showYear("2025");
};

/* 
  11. QUARTER COUNTING + SUMMARY RENDERING
*/
function getQuarterFromMonth(monthName) {
  const m = (monthName || "").toLowerCase();
  if (["january","february","march"].includes(m)) return "Q1";
  if (["april","may","june"].includes(m)) return "Q2";
  if (["july","august","september"].includes(m)) return "Q3";
  if (["october","november","december"].includes(m)) return "Q4";
  return null;
}
function computeBrandAppearances(camps) {
  const brandQuarterCounts = {};
  camps.forEach((c) => {
    const brand = c.brand || "Unknown";
    const quarter = getQuarterFromMonth(c.saleMonth);
    if (!brandQuarterCounts[brand]) {
      brandQuarterCounts[brand] = { Q1:0, Q2:0, Q3:0, Q4:0 };
    }
    if (quarter) {
      brandQuarterCounts[brand][quarter]++;
    }
  });
  return brandQuarterCounts;
}
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

/* 
  12. Drag-and-Drop Reordering 
*/
async function updateDashboardOrder(newOrder) {
  console.log("New order of entries:", newOrder);
  /*
  // If storing new order in Firestore using an orderIndex:
  for (let idx = 0; idx < newOrder.length; idx++) {
    const docId = newOrder[idx];
    const docRef = doc(db, `campaigns_${currentYear}`, docId);
    await updateDoc(docRef, { orderIndex: idx });
  }
  */
}

/* 
   13. Spinner & Toast Helpers
*/
function showLoadingModal() {
  const modal = document.getElementById("loadingModal");
  if (modal) modal.style.display = "flex";
}
function hideLoadingModal() {
  const modal = document.getElementById("loadingModal");
  if (modal) modal.style.display = "none";
}

function showSuccessToast(message) {
  createToast(message, "toast-success");
}
function showErrorToast(message) {
  createToast(message, "toast-error");
}
function createToast(message, className) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast-message ${className}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-remove after 3s
  setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
  }, 3000);
}

/* 
   14. Expose Functions for Inline Handlers
*/
window.showYear = showYear;
window.openImage = openImage;
window.updateDashboardOrder = updateDashboardOrder;
window.setSearchKeyword = setSearchKeyword;  // For the search bar
window.prevPage = prevPage;                 // For pagination
window.nextPage = nextPage;
