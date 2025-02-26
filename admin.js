/****************************************************
 * admin.js - Firestore Version (Real-Time Sync)
 * With Error Handling, Form Validation, Loading Spinner,
 * and Toast Messages
 ****************************************************/

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from "./firebaseSync.js";

// In-memory array of campaigns for inline editing
let campaigns = [];

/* -----------------------------------
   1. LOGIN CHECK - Redirect if not logged in
----------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  const correctPassword = "marketing123";
  const userPassword = sessionStorage.getItem("adminAuth");

  if (userPassword !== correctPassword) {
    window.location.href = "login.html";
  }
});

/* -----------------------------------
   2. SHOW YEAR - Called by the year buttons
   Sets up a real-time listener for that year's campaigns.
----------------------------------- */
function showYear(year) {
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  watchCampaigns(year); // Real-time Firestore listener
}

/* -----------------------------------
   watchCampaigns(year):
   - Attaches onSnapshot to "campaigns_YEAR" for real-time updates.
   - Whenever Firestore data changes, onSnapshot triggers displayCampaigns().
----------------------------------- */
function watchCampaigns(year) {
  const colRef = collection(db, `campaigns_${year}`);

  // Clear existing data
  campaigns = [];

  // onSnapshot sets up a persistent listener
  onSnapshot(colRef, (snapshot) => {
    campaigns = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    displayCampaigns();
  });
}

/* -----------------------------------
   3. FORM SUBMISSION - Add a new campaign
   With validation & loading spinner
----------------------------------- */
document.getElementById("campaignForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  // Identify the current year from heading
  const yearText = document.getElementById("yearTitle").textContent;
  const selectedYear = yearText.split(" ")[2]; // e.g., "2024"

  // Gather form fields
  const brand = document.getElementById("brand").value;
  const saleMonth = document.getElementById("saleMonth").value;
  const campaignName = document.getElementById("campaignName").value;
  const campaignType = document.getElementById("campaignType").value;
  const pageLocation = document.getElementById("pageLocation").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const engagementNotes = document.getElementById("engagementNotes").value;
  const imageFile = document.getElementById("campaignImage").files[0];

  // Basic Form Validation
  if (!brand || !campaignName || !startDate || !endDate) {
    showErrorToast("Please fill out all required fields (brand, campaign name, start/end dates).");
    return;
  }
  if (new Date(endDate) < new Date(startDate)) {
    showErrorToast("End date cannot be earlier than start date.");
    return;
  }

  // Show spinner while saving
  showSavingModal();
  try {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        const imageUrl = e.target.result;
        await saveCampaignToFirestore(selectedYear, {
          brand,
          saleMonth,
          campaignName,
          campaignType,
          pageLocation,
          startDate,
          endDate,
          engagementNotes,
          imageUrl
        });
        document.getElementById("campaignForm").reset();
        hideSavingModal();
      };
      reader.readAsDataURL(imageFile);
    } else {
      // No image
      await saveCampaignToFirestore(selectedYear, {
        brand,
        saleMonth,
        campaignName,
        campaignType,
        pageLocation,
        startDate,
        endDate,
        engagementNotes,
        imageUrl: ""
      });
      document.getElementById("campaignForm").reset();
      hideSavingModal();
    }
  } catch (error) {
    console.error("Error uploading campaign:", error);
    showErrorToast("Failed to save campaign. Please try again.");
    hideSavingModal();
  }
});

/* -----------------------------------
   4. SAVE CAMPAIGN - Add a new doc to Firestore
   With error handling & toast feedback
----------------------------------- */
async function saveCampaignToFirestore(year, campaignData) {
  try {
    const colRef = collection(db, `campaigns_${year}`);
    await addDoc(colRef, campaignData);
    showSuccessToast("Campaign saved successfully!");
    // onSnapshot auto-refreshes displayCampaigns()
  } catch (error) {
    console.error("Error saving campaign:", error);
    showErrorToast("Failed to save campaign. Please try again.");
  }
}

/* -----------------------------------
   5. DATE FORMATTER - Converts "YYYY-MM-DD" -> "DD/MM/YYYY"
----------------------------------- */
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`; 
}

/* -----------------------------------
   6. DISPLAY CAMPAIGNS - Populate the table
----------------------------------- */
function displayCampaigns() {
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  campaignTableBody.innerHTML = "";

  if (campaigns.length === 0) {
    campaignTableBody.innerHTML = "<tr><td colspan='10'>No campaigns added for this year.</td></tr>";
    return;
  }

  // Build a row for each campaign
  campaigns.forEach((campaign, index) => {
    const row = document.createElement("tr");
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
            ? `<img src="${campaign.imageUrl}" width="50" alt="Campaign Image"
                  onclick="openImage('${campaign.imageUrl}')">
               <br>
               <a href="${campaign.imageUrl}" download="campaign-image.png"
                  class="download-btn">Download</a>`
            : "No image"
        }
      </td>
      <td>
        <button onclick="editCampaign(${index})">✏️ Edit</button>
        <button class="delete-btn" onclick="deleteCampaign(${index})">❌ Delete</button>
      </td>
    `;
    campaignTableBody.appendChild(row);
  });
}

/* -----------------------------------
   7. DELETE CAMPAIGN
   With error handling & toast feedback
----------------------------------- */
async function deleteCampaign(index) {
  const campaignToDelete = campaigns[index];
  const yearText = document.getElementById("yearTitle").textContent;
  const selectedYear = yearText.split(" ")[2];

  if (!campaignToDelete?.id) {
    showErrorToast("Cannot delete campaign, no valid ID found.");
    return;
  }
  // Show spinner
  showSavingModal();
  try {
    await deleteDoc(doc(db, `campaigns_${selectedYear}`, campaignToDelete.id));
    showSuccessToast("Campaign deleted successfully!");
  } catch (error) {
    console.error("Error deleting campaign:", error);
    showErrorToast("Failed to delete campaign. Please try again.");
  } finally {
    hideSavingModal();
  }
}

/* -----------------------------------
   8. EDIT CAMPAIGN - Inline editing
----------------------------------- */
function editCampaign(index) {
  const campaign = campaigns[index];
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  const row = campaignTableBody.rows[index];

  row.innerHTML = `
    <td><input type="text" id="editBrand${index}" value="${campaign.brand || ""}"></td>
    <td><input type="text" id="editSaleMonth${index}" value="${campaign.saleMonth || ""}"></td>
    <td><input type="text" id="editCampaignName${index}" value="${campaign.campaignName || ""}"></td>
    <td><input type="text" id="editCampaignType${index}" value="${campaign.campaignType || ""}"></td>
    <td><input type="text" id="editPageLocation${index}" value="${campaign.pageLocation || ""}"></td>
    <td><input type="date" id="editStartDate${index}" value="${campaign.startDate || ""}"></td>
    <td><input type="date" id="editEndDate${index}" value="${campaign.endDate || ""}"></td>
    <td><input type="text" id="editEngagementNotes${index}" value="${campaign.engagementNotes || ""}"></td>
    <td>
      <img class="editImagePreview" src="${campaign.imageUrl || ''}" width="50" alt="Campaign Image">
      <br>
      <input type="file" id="editImage${index}" class="editImageInput" accept="image/*"
             style="display: none;"
             onchange="updateEditImagePreview(${index}, this)">
      <button type="button" onclick="triggerEditImage(this)">Change Image</button>
      <br>
      ${
        campaign.imageUrl 
          ? `<a href="${campaign.imageUrl}" download="campaign-image.png"
                class="download-btn">Download</a>` 
          : ""
      }
    </td>
    <td>
      <button onclick="saveEditedCampaign(${index})">💾 Save</button>
      <button onclick="cancelEdit()">Cancel</button>
    </td>
  `;
}

/* -----------------------------------
   9. CANCEL EDIT - Re-displays table
----------------------------------- */
function cancelEdit() {
  displayCampaigns();
}

/* -----------------------------------
   Trigger file input in edit mode
----------------------------------- */
function triggerEditImage(button) {
  const row = button.closest("tr");
  const fileInput = row.querySelector(".editImageInput");
  if (fileInput) fileInput.click();
}

/* -----------------------------------
   Update preview image on new file in edit mode
----------------------------------- */
function updateEditImagePreview(index, inputElement) {
  const file = inputElement.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const row = inputElement.closest("tr");
      const preview = row.querySelector(".editImagePreview");
      if (preview) {
        preview.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}

/* -----------------------------------
   10. SAVE EDITED CAMPAIGN - update doc
   With error handling, spinner, toast feedback
----------------------------------- */
async function saveEditedCampaign(index) {
  const updated = { ...campaigns[index] };
  const yearText = document.getElementById("yearTitle").textContent;
  const selectedYear = yearText.split(" ")[2];

  updated.brand = document.getElementById(`editBrand${index}`).value;
  updated.saleMonth = document.getElementById(`editSaleMonth${index}`).value;
  updated.campaignName = document.getElementById(`editCampaignName${index}`).value;
  updated.campaignType = document.getElementById(`editCampaignType${index}`).value;
  updated.pageLocation = document.getElementById(`editPageLocation${index}`).value;
  updated.startDate = document.getElementById(`editStartDate${index}`).value;
  updated.endDate = document.getElementById(`editEndDate${index}`).value;
  updated.engagementNotes = document.getElementById(`editEngagementNotes${index}`).value;

  // Basic validation: brand, campaignName, startDate, endDate
  if (!updated.brand || !updated.campaignName || !updated.startDate || !updated.endDate) {
    showErrorToast("Please fill out brand, campaign name, start/end dates.");
    return;
  }
  if (new Date(updated.endDate) < new Date(updated.startDate)) {
    showErrorToast("End date cannot be earlier than start date.");
    return;
  }

  // Check for new image
  const imageInput = document.getElementById(`editImage${index}`);
  showSavingModal();
  try {
    if (imageInput && imageInput.files.length > 0) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        updated.imageUrl = e.target.result;
        await updateCampaignInFirestore(selectedYear, updated);
        hideSavingModal();
      };
      reader.readAsDataURL(imageInput.files[0]);
    } else {
      // No new image
      await updateCampaignInFirestore(selectedYear, updated);
      hideSavingModal();
    }
  } catch (error) {
    console.error("Error saving edited campaign:", error);
    showErrorToast("Failed to save changes. Please try again.");
    hideSavingModal();
  }
}

/* -----------------------------------
   updateCampaignInFirestore: updates doc in Firestore
----------------------------------- */
async function updateCampaignInFirestore(year, updated) {
  if (!updated.id) {
    console.error("Cannot update, missing doc ID.");
    return;
  }
  try {
    const docRef = doc(db, `campaigns_${year}`, updated.id);
    const { id, ...dataToSave } = updated;
    await updateDoc(docRef, dataToSave);
    showSuccessToast("Campaign updated successfully!");
  } catch (error) {
    console.error("Error updating campaign:", error);
    showErrorToast("Failed to update campaign. Please try again.");
  }
}

/* -----------------------------------
   11. OPEN IMAGE IN NEW TAB
----------------------------------- */
function openImage(url) {
  window.open(url, "_blank");
}

/* -----------------------------------
   12. DEFAULT YEAR ON LOAD
----------------------------------- */
window.onload = function () {
  showYear("2025");
};

/* 
   =============== NEW: Spinner & Toast Helpers ===============
   Make sure index.html has:
   <div id="savingModal" class="saving-modal" style="display:none;">...</div>
   <div id="toastContainer" class="toast-container"></div>
*/

/* Show/Hide Spinner */
function showSavingModal() {
  const modal = document.getElementById("savingModal");
  if (modal) modal.style.display = "flex";
}
function hideSavingModal() {
  const modal = document.getElementById("savingModal");
  if (modal) modal.style.display = "none";
}

/* Toasts for success/error feedback */
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
    if (container.contains(toast)) container.removeChild(toast);
  }, 3000);
}

/* 
   =============== EXPOSE FUNCTIONS FOR HTML EVENT HANDLERS ===============
*/
window.showYear = showYear;
window.openImage = openImage;
window.editCampaign = editCampaign;
window.deleteCampaign = deleteCampaign;
window.triggerEditImage = triggerEditImage;
window.updateEditImagePreview = updateEditImagePreview;
window.saveEditedCampaign = saveEditedCampaign;
window.cancelEdit = cancelEdit;
