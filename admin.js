/****************************************************
 * admin.js - Firestore Version (Real-Time Sync)
 * With Error Handling, Form Validation, Loading Spinner,
 * Toast Messages, Logout, and Role-Based UI
 ****************************************************/

// --- Authentication Check & Role Retrieval ---
import { auth, db } from "./firebaseSync.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Global variable to hold the current user's role (default to viewer)
let currentUserRole = "viewer";

// Check authentication and load user role from Firestore
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    console.log("Logged in as:", user.email);
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        currentUserRole = userData.role || "viewer"; // default to viewer if not set
        // If the user is an admin, show the Manage User Roles button and campaign form
        if (currentUserRole === "admin") {
          const manageButton = document.getElementById("manageUsersButton");
          if (manageButton) manageButton.style.display = "inline-block";
          if (document.getElementById("campaignForm")) {
            document.getElementById("campaignForm").style.display = "block";
          }
        } else {
          // If the user is a viewer, hide the campaign form
          if (document.getElementById("campaignForm")) {
            document.getElementById("campaignForm").style.display = "none";
          }
        }
      } else {
        alert("User data not found. Contact support.");
        window.location.href = "login.html";
      }
    } catch (error) {
      console.error("Error checking user role:", error);
      alert("Error verifying user role.");
      window.location.href = "login.html";
    }
  }
});

// --- Logout Function ---
function logout() {
  signOut(auth)
    .then(() => {
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
      alert("Failed to log out. Please try again.");
    });
}
window.logout = logout; // Expose logout globally so HTML can call it

// --- Firestore Setup ---
import {
  collection,
  doc as docFS, // alias to avoid naming conflicts
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// In-memory array for campaigns
let campaigns = [];

/* -----------------------------------
   SHOW YEAR - Called by the year buttons
----------------------------------- */
function showYear(year) {
  document.getElementById("yearTitle").textContent = Campaigns for ${year};
  watchCampaigns(year);
}
window.showYear = showYear;

/* -----------------------------------
   watchCampaigns(year):
   Attaches a real-time listener to "campaigns_YEAR"
----------------------------------- */
function watchCampaigns(year) {
  const colRef = collection(db, campaigns_${year});
  campaigns = [];
  onSnapshot(colRef, (snapshot) => {
    campaigns = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    displayCampaigns();
  }, (err) => {
    console.error("onSnapshot error:", err);
    showErrorToast("Firestore error: " + err.message);
  });
}

/* -----------------------------------
   FORM SUBMISSION - Add new campaign
   With validation & loading spinner (admin only)
----------------------------------- */
if (document.getElementById("campaignForm")) {
  document.getElementById("campaignForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    // Only allow submission if user is admin
    if (currentUserRole !== "admin") {
      showErrorToast("You do not have permission to add campaigns.");
      return;
    }

    // Identify the selected year from the heading
    const yearText = document.getElementById("yearTitle").textContent;
    const selectedYear = yearText.split(" ")[2];

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

    // Basic validation
    if (!brand || !campaignName || !startDate || !endDate) {
      showErrorToast("Please fill out all required fields (brand, campaign name, start/end dates).");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showErrorToast("End date cannot be earlier than start date.");
      return;
    }

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
            imageUrl,
            dateUploaded: new Date().toISOString()
          });
          document.getElementById("campaignForm").reset();
          hideSavingModal();
        };
        reader.readAsDataURL(imageFile);
      } else {
        await saveCampaignToFirestore(selectedYear, {
          brand,
          saleMonth,
          campaignName,
          campaignType,
          pageLocation,
          startDate,
          endDate,
          engagementNotes,
          imageUrl: "",
          dateUploaded: new Date().toISOString()
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
}

/* -----------------------------------
   SAVE CAMPAIGN - Add document to Firestore
   With error handling & toast feedback
----------------------------------- */
async function saveCampaignToFirestore(year, campaignData) {
  try {
    const colRef = collection(db, campaigns_${year});
    await addDoc(colRef, campaignData);
    showSuccessToast("Campaign saved successfully!");
  } catch (error) {
    console.error("Error saving campaign:", error);
    showErrorToast("Failed to save campaign. Please try again.");
  }
}

/* -----------------------------------
   DATE FORMATTER - Converts "YYYY-MM-DD" to "DD/MM/YYYY"
----------------------------------- */
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return ${day}/${month}/${year};
}

/* -----------------------------------
   DISPLAY CAMPAIGNS - Render campaigns in the table
   For viewers, do not show edit/delete buttons.
----------------------------------- */
function displayCampaigns() {
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  campaignTableBody.innerHTML = "";

  if (campaigns.length === 0) {
    campaignTableBody.innerHTML = "<tr><td colspan='10'>No campaigns added for this year.</td></tr>";
    return;
  }

  campaigns.forEach((campaign, index) => {
    const row = document.createElement("tr");
    const actionsHTML = (currentUserRole === "admin") ?
      <button onclick="editCampaign(${index})">✏️ Edit</button>
       <button class="delete-btn" onclick="deleteCampaign(${index})">❌ Delete</button> : "";
    row.innerHTML = 
      <td>${campaign.brand || ""}</td>
      <td>${campaign.saleMonth || ""}</td>
      <td>${campaign.campaignName || ""}</td>
      <td>${campaign.campaignType || ""}</td>
      <td>${campaign.pageLocation || ""}</td>
      <td>${formatDateToDMY(campaign.startDate)}</td>
      <td>${formatDateToDMY(campaign.endDate)}</td>
      <td>${campaign.engagementNotes || ""}</td>
      <td>
        ${campaign.imageUrl
          ? <img src="${campaign.imageUrl}" width="50" alt="Campaign Image" onclick="openImage('${campaign.imageUrl}')">
             <br>
             <a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a>
          : "No image"}
      </td>
      <td>
        ${actionsHTML}
      </td>
    ;
    campaignTableBody.appendChild(row);
  });
}

/* -----------------------------------
   DELETE CAMPAIGN - Remove document from Firestore
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
  showSavingModal();
  try {
    await deleteDoc(docFS(db, campaigns_${selectedYear}, campaignToDelete.id));
    showSuccessToast("Campaign deleted successfully!");
  } catch (error) {
    console.error("Error deleting campaign:", error);
    showErrorToast("Failed to delete campaign. Please try again.");
  } finally {
    hideSavingModal();
  }
}

/* -----------------------------------
   EDIT CAMPAIGN - Inline editing (admin only)
----------------------------------- */
function editCampaign(index) {
  if (currentUserRole !== "admin") {
    showErrorToast("You do not have permission to edit campaigns.");
    return;
  }
  const campaign = campaigns[index];
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  const row = campaignTableBody.rows[index];

  row.innerHTML = 
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
      <input type="file" id="editImage${index}" class="editImageInput" accept="image/*" style="display: none;" onchange="updateEditImagePreview(${index}, this)">
      <button type="button" onclick="triggerEditImage(this)">Change Image</button>
      <br>
      ${campaign.imageUrl ? <a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a> : ""}
    </td>
    <td>
      <button onclick="saveEditedCampaign(${index})">💾 Save</button>
      <button onclick="cancelEdit()">Cancel</button>
    </td>
  ;
}

/* -----------------------------------
   CANCEL EDIT - Restore original display
----------------------------------- */
function cancelEdit() {
  displayCampaigns();
}

/* -----------------------------------
   TRIGGER FILE INPUT (for edit mode)
----------------------------------- */
function triggerEditImage(button) {
  const row = button.closest("tr");
  const fileInput = row.querySelector(".editImageInput");
  if (fileInput) fileInput.click();
}

/* -----------------------------------
   UPDATE PREVIEW IMAGE on file selection in edit mode
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
   SAVE EDITED CAMPAIGN - Update Firestore doc
   With error handling, loading spinner, and toast feedback
----------------------------------- */
async function saveEditedCampaign(index) {
  const updated = { ...campaigns[index] };
  const yearText = document.getElementById("yearTitle").textContent;
  const selectedYear = yearText.split(" ")[2];

  updated.brand = document.getElementById(editBrand${index}).value;
  updated.saleMonth = document.getElementById(editSaleMonth${index}).value;
  updated.campaignName = document.getElementById(editCampaignName${index}).value;
  updated.campaignType = document.getElementById(editCampaignType${index}).value;
  updated.pageLocation = document.getElementById(editPageLocation${index}).value;
  updated.startDate = document.getElementById(editStartDate${index}).value;
  updated.endDate = document.getElementById(editEndDate${index}).value;
  updated.engagementNotes = document.getElementById(editEngagementNotes${index}).value;

  // Basic validation
  if (!updated.brand || !updated.campaignName || !updated.startDate || !updated.endDate) {
    showErrorToast("Please fill out brand, campaign name, and start/end dates.");
    return;
  }
  if (new Date(updated.endDate) < new Date(updated.startDate)) {
    showErrorToast("End date cannot be earlier than start date.");
    return;
  }

  const imageInput = document.getElementById(editImage${index});
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
   updateCampaignInFirestore: updates the existing doc in Firestore
----------------------------------- */
async function updateCampaignInFirestore(year, updated) {
  if (!updated.id) {
    console.error("Cannot update, missing doc ID.");
    return;
  }
  try {
    const docRef = docFS(db, campaigns_${year}, updated.id);
    const { id, ...dataToSave } = updated;
    await updateDoc(docRef, dataToSave);
    showSuccessToast("Campaign updated successfully!");
  } catch (error) {
    console.error("Error updating campaign:", error);
    showErrorToast("Failed to update campaign. Please try again.");
  }
}

/* -----------------------------------
   OPEN IMAGE IN NEW TAB
----------------------------------- */
function openImage(url) {
  window.open(url, "_blank");
}

/* -----------------------------------
   DEFAULT YEAR ON LOAD
----------------------------------- */
window.onload = function () {
  showYear("2025");
};

/* ====================================
   SPINNER & TOAST HELPERS
   Ensure your HTML has:
   <div id="savingModal" class="saving-modal" style="display:none;">...</div>
   <div id="toastContainer" class="toast-container"></div>
==================================== */
function showSavingModal() {
  const modal = document.getElementById("savingModal");
  if (modal) modal.style.display = "flex";
}
function hideSavingModal() {
  const modal = document.getElementById("savingModal");
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
  toast.className = toast-message ${className};
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (container.contains(toast)) container.removeChild(toast);
  }, 3000);
}

/* ====================================
   EXPOSE FUNCTIONS FOR INLINE EVENT HANDLERS
==================================== */
window.openImage = openImage;
window.editCampaign = editCampaign;
window.deleteCampaign = deleteCampaign;
window.triggerEditImage = triggerEditImage;
window.updateEditImagePreview = updateEditImagePreview;
window.saveEditedCampaign = saveEditedCampaign;
window.cancelEdit = cancelEdit;