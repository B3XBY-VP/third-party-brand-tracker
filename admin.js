/****************************************************
 * admin.js - Firestore Version (Real-Time Sync)
 ****************************************************/

// 1. IMPORT FIRESTORE (ES Modules)
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 2. Get Firestore instance from your firebaseSync.js
import { db } from "./firebaseSync.js";

// In-memory array of campaigns for inline editing
let campaigns = [];

/*
  1. LOGIN CHECK - Redirect if not logged in
*/
document.addEventListener("DOMContentLoaded", function () {
  const correctPassword = "marketing123";
  const userPassword = sessionStorage.getItem("adminAuth");

  if (userPassword !== correctPassword) {
    window.location.href = "login.html";
  }
});

/*
  2. SHOW YEAR - Called by the year buttons
  Sets up a real-time listener for that year's campaigns.
*/
function showYear(year) {
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  watchCampaigns(year); // Real-time Firestore listener
}

/*
  watchCampaigns(year):
  - Attaches onSnapshot to "campaigns_YEAR" for real-time updates.
  - Whenever Firestore data changes, onSnapshot triggers displayCampaigns().
*/
function watchCampaigns(year) {
  const colRef = collection(db, `campaigns_${year}`);

  // Clear existing data
  campaigns = [];

  // onSnapshot sets up a persistent listener
  onSnapshot(colRef, (snapshot) => {
    // Rebuild the in-memory array each time there's a change
    campaigns = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    // Re-render the table
    displayCampaigns();
  });
}

/*
  3. FORM SUBMISSION - Add a new campaign
*/
document.getElementById("campaignForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  // Identify the currently displayed year from the heading
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

  // Convert the image to Base64 if provided
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
  }
});

/*
  4. SAVE CAMPAIGN - Add a new doc to Firestore
*/
async function saveCampaignToFirestore(year, campaignData) {
  try {
    const colRef = collection(db, `campaigns_${year}`);
    await addDoc(colRef, campaignData);
    // onSnapshot automatically refreshes displayCampaigns()
  } catch (error) {
    console.error("Error saving campaign:", error);
  }
}

/*
  5. DATE FORMATTER - Converts "YYYY-MM-DD" -> "DD/MM/YYYY"
*/
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`; 
}

/*
  6. DISPLAY CAMPAIGNS - Populate the table using our in-memory 'campaigns' array
*/
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

/*
  7. DELETE CAMPAIGN - remove the doc from Firestore
*/
async function deleteCampaign(index) {
  const campaignToDelete = campaigns[index];
  const yearText = document.getElementById("yearTitle").textContent;
  const selectedYear = yearText.split(" ")[2];

  if (!campaignToDelete?.id) {
    console.error("No doc ID found, cannot delete.");
    return;
  }
  try {
    await deleteDoc(doc(db, `campaigns_${selectedYear}`, campaignToDelete.id));
    // onSnapshot will update the table automatically
  } catch (error) {
    console.error("Error deleting campaign:", error);
  }
}

/*
  8. EDIT CAMPAIGN - Inline editing of an existing row
  We'll replace the row’s cells with input fields, referencing the in-memory array.
*/
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

/*
  9. CANCEL EDIT - Just re-displays the table
*/
function cancelEdit() {
  displayCampaigns();
}

/*
  Trigger the file input in edit mode
*/
function triggerEditImage(button) {
  const row = button.closest("tr");
  const fileInput = row.querySelector(".editImageInput");
  if (fileInput) {
    fileInput.click();
  }
}

/*
  Update the preview image when a new file is selected in edit mode
*/
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

/*
  10. SAVE EDITED CAMPAIGN
  - Build updated object
  - Update doc in Firestore
*/
async function saveEditedCampaign(index) {
  const updated = { ...campaigns[index] }; // copy existing data
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

  // If there's a new image
  const imageInput = document.getElementById(`editImage${index}`);
  if (imageInput && imageInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      updated.imageUrl = e.target.result;
      await updateCampaignInFirestore(selectedYear, updated);
    };
    reader.readAsDataURL(imageInput.files[0]);
  } else {
    // No new image
    await updateCampaignInFirestore(selectedYear, updated);
  }
}

/*
  updateCampaignInFirestore: updates the existing doc in Firestore
*/
async function updateCampaignInFirestore(year, updated) {
  if (!updated.id) {
    console.error("Cannot update, missing doc ID.");
    return;
  }
  try {
    const docRef = doc(db, `campaigns_${year}`, updated.id);
    // Omit the doc ID from the actual data
    const { id, ...dataToSave } = updated;
    await updateDoc(docRef, dataToSave);
    // onSnapshot refreshes displayCampaigns()
  } catch (error) {
    console.error("Error updating campaign:", error);
  }
}

/*
  11. OPEN IMAGE IN NEW TAB
*/
function openImage(url) {
  window.open(url, "_blank");
}

/*
  12. DEFAULT YEAR ON LOAD
*/
window.onload = function () {
  showYear("2024");
};

/*
   Expose functions to the global scope for inline HTML event handlers
   (if you're using <button onclick="...">).
*/
window.showYear = showYear;
window.openImage = openImage;
window.editCampaign = editCampaign;
window.deleteCampaign = deleteCampaign;
window.triggerEditImage = triggerEditImage;
window.updateEditImagePreview = updateEditImagePreview;
window.saveEditedCampaign = saveEditedCampaign;
window.cancelEdit = cancelEdit;
