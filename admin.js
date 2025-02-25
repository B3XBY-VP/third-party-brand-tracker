/****************************************************
 * admin.js - Updated to use Firestore for Campaign Storage
 ****************************************************/

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 1. LOGIN CHECK - Redirect if not logged in
document.addEventListener("DOMContentLoaded", function () {
  const correctPassword = "marketing123";
  const userPassword = sessionStorage.getItem("adminAuth");

  if (userPassword !== correctPassword) {
    window.location.href = "login.html";
  }
});

// 2. SHOW YEAR - Called by the year buttons
function showYear(year) {
  // Update the heading to reflect the chosen year
  document.getElementById("yearTitle").textContent = `Campaigns for ${year}`;
  // Display campaigns stored in Firestore for that year
  displayCampaigns(year);
}
window.showYear = showYear;

// 3. FORM SUBMISSION - Add a new campaign to Firestore
document.getElementById("campaignForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  // Determine selected year from the heading ("Campaigns for 2024")
  const yearText = document.getElementById("yearTitle").textContent; 
  const selectedYear = yearText.split(" ")[2];

  // Gather form field values
  const brand = document.getElementById("brand").value;
  const saleMonth = document.getElementById("saleMonth").value;
  const campaignName = document.getElementById("campaignName").value;
  const campaignType = document.getElementById("campaignType").value;
  const pageLocation = document.getElementById("pageLocation").value;
  const startDate = document.getElementById("startDate").value;  // ISO format
  const endDate = document.getElementById("endDate").value;      // ISO format
  const engagementNotes = document.getElementById("engagementNotes").value;
  const imageFile = document.getElementById("campaignImage").files[0];

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const imageUrl = e.target.result; // Base64 string
      await saveCampaign(
        selectedYear,
        brand,
        saleMonth,
        campaignName,
        campaignType,
        pageLocation,
        startDate,
        endDate,
        engagementNotes,
        imageUrl
      );
    };
    reader.readAsDataURL(imageFile);
  } else {
    await saveCampaign(
      selectedYear,
      brand,
      saleMonth,
      campaignName,
      campaignType,
      pageLocation,
      startDate,
      endDate,
      engagementNotes,
      ""
    );
  }

  // Reset form fields after submission
  document.getElementById("campaignForm").reset();
});

// 4. SAVE CAMPAIGN - Store campaign in Firestore
async function saveCampaign(
  year,
  brand,
  saleMonth,
  campaignName,
  campaignType,
  pageLocation,
  startDate,
  endDate,
  engagementNotes,
  imageUrl
) {
  try {
    await addDoc(collection(window.db, "campaigns"), {
      year,
      brand,
      saleMonth,
      campaignName,
      campaignType,
      pageLocation,
      startDate,  // stored as ISO string
      endDate,    // stored as ISO string
      engagementNotes,
      imageUrl
    });
  } catch (error) {
    console.error("Error saving campaign:", error);
  }
}

// 5. DATE FORMATTER - Converts "YYYY-MM-DD" to "DD/MM/YYYY"
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

// 6. DISPLAY CAMPAIGNS - Populate the table using Firestore's real-time updates
function displayCampaigns(year) {
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  campaignTableBody.innerHTML = "";

  // Create a query filtering campaigns by the selected year
  const q = query(collection(window.db, "campaigns"), where("year", "==", year));
  
  onSnapshot(q, (snapshot) => {
    campaignTableBody.innerHTML = "";
    
    if (snapshot.empty) {
      campaignTableBody.innerHTML = "<tr><td colspan='10'>No campaigns added for this year.</td></tr>";
      return;
    }
    
    snapshot.forEach((docSnap) => {
      const campaign = docSnap.data();
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
          ${campaign.imageUrl
            ? `<img src="${campaign.imageUrl}" width="50" alt="Campaign Image" onclick="openImage('${campaign.imageUrl}')">
               <br>
               <a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a>`
            : "No image"}
        </td>
        <td>
          <button onclick="editCampaign('${docSnap.id}', '${year}')">✏️ Edit</button>
          <button class="delete-btn" onclick="deleteCampaign('${docSnap.id}', '${year}')">❌ Delete</button>
        </td>
      `;
      campaignTableBody.appendChild(row);
    });
  });
}

// 7. DELETE CAMPAIGN - Remove a campaign from Firestore
async function deleteCampaign(docId, year) {
  try {
    await deleteDoc(doc(window.db, "campaigns", docId));
  } catch (error) {
    console.error("Error deleting campaign:", error);
  }
}

// 8. EDIT CAMPAIGN - Inline editing of an existing campaign
function editCampaign(docId, year) {
  // Locate the table row corresponding to the campaign to edit
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  const rows = campaignTableBody.getElementsByTagName("tr");
  let rowToEdit = null;
  for (let row of rows) {
    if (row.querySelector(`button[onclick*="${docId}"]`)) {
      rowToEdit = row;
      break;
    }
  }
  if (!rowToEdit) return;

  // Fetch current campaign data from Firestore
  getDoc(doc(window.db, "campaigns", docId))
    .then((docSnap) => {
      if (docSnap.exists()) {
        const campaign = docSnap.data();
        rowToEdit.innerHTML = `
          <td><input type="text" id="editBrand" value="${campaign.brand || ""}"></td>
          <td><input type="text" id="editSaleMonth" value="${campaign.saleMonth || ""}"></td>
          <td><input type="text" id="editCampaignName" value="${campaign.campaignName || ""}"></td>
          <td><input type="text" id="editCampaignType" value="${campaign.campaignType || ""}"></td>
          <td><input type="text" id="editPageLocation" value="${campaign.pageLocation || ""}"></td>
          <td><input type="date" id="editStartDate" value="${campaign.startDate || ""}"></td>
          <td><input type="date" id="editEndDate" value="${campaign.endDate || ""}"></td>
          <td><input type="text" id="editEngagementNotes" value="${campaign.engagementNotes || ""}"></td>
          <td>
            <img class="editImagePreview" src="${campaign.imageUrl || ''}" width="50" alt="Campaign Image">
            <br>
            <input type="file" id="editImage" class="editImageInput" accept="image/*" style="display: none;" onchange="updateEditImagePreview(this)">
            <button type="button" onclick="triggerEditImage(this)">Change Image</button>
            <br>
            ${campaign.imageUrl ? `<a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a>` : ""}
          </td>
          <td>
            <button onclick="saveEditedCampaign('${docId}', '${year}')">💾 Save</button>
            <button onclick="cancelEdit('${year}')">Cancel</button>
          </td>
        `;
      }
    })
    .catch((error) => console.error("Error fetching campaign for edit:", error));
}

// 9. Trigger file input in edit mode
function triggerEditImage(button) {
  const row = button.closest("tr");
  const fileInput = row.querySelector(".editImageInput");
  if (fileInput) {
    fileInput.click();
  }
}

// 10. Update preview image when a new file is selected in edit mode
function updateEditImagePreview(inputElement) {
  const file = inputElement.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const row = inputElement.closest("tr");
      const preview = row.querySelector(".editImagePreview");
      if (preview) {
        preview.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}

// 11. SAVE EDITED CAMPAIGN - Update the campaign in Firestore
async function saveEditedCampaign(docId, year) {
  const updatedCampaign = {
    brand: document.getElementById("editBrand").value,
    saleMonth: document.getElementById("editSaleMonth").value,
    campaignName: document.getElementById("editCampaignName").value,
    campaignType: document.getElementById("editCampaignType").value,
    pageLocation: document.getElementById("editPageLocation").value,
    startDate: document.getElementById("editStartDate").value,
    endDate: document.getElementById("editEndDate").value,
    engagementNotes: document.getElementById("editEngagementNotes").value
  };

  const imageInput = document.getElementById("editImage");
  if (imageInput && imageInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      updatedCampaign.imageUrl = e.target.result;
      try {
        await updateDoc(doc(window.db, "campaigns", docId), updatedCampaign);
      } catch (error) {
        console.error("Error updating campaign:", error);
      }
    };
    reader.readAsDataURL(imageInput.files[0]);
  } else {
    try {
      await updateDoc(doc(window.db, "campaigns", docId), updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  }
}

// 12. CANCEL EDIT - Reload campaigns from Firestore
function cancelEdit(year) {
  displayCampaigns(year);
}

// 13. OPEN IMAGE IN NEW TAB
function openImage(url) {
  window.open(url, "_blank");
}

// 14. DEFAULT YEAR ON LOAD
window.onload = function () {
  showYear("2024");
};
