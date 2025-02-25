/****************************************************
 * admin.js
 ****************************************************/

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
  // Display campaigns stored in localStorage for that year
  displayCampaigns(year);
}

// 3. FORM SUBMISSION - Add a new campaign
document.getElementById("campaignForm").addEventListener("submit", function (event) {
  event.preventDefault();

  // Figure out which year is currently selected from the heading
  const yearText = document.getElementById("yearTitle").textContent; 
  // "Campaigns for 2024" => split => ["Campaigns", "for", "2024"]
  const selectedYear = yearText.split(" ")[2];

  // Gather form field values
  const brand = document.getElementById("brand").value;
  const saleMonth = document.getElementById("saleMonth").value;
  const campaignName = document.getElementById("campaignName").value;
  const campaignType = document.getElementById("campaignType").value;
  const pageLocation = document.getElementById("pageLocation").value;
  const startDate = document.getElementById("startDate").value;  // "YYYY-MM-DD"
  const endDate = document.getElementById("endDate").value;      // "YYYY-MM-DD"
  const engagementNotes = document.getElementById("engagementNotes").value;
  const imageFile = document.getElementById("campaignImage").files[0];

  // If there's an image, convert it to Base64, then save
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const imageUrl = e.target.result; // Base64 string
      saveCampaign(
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
    // No image uploaded
    saveCampaign(
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

  // Reset form fields
  document.getElementById("campaignForm").reset();
});

// 4. SAVE CAMPAIGN - Store in localStorage
function saveCampaign(
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
  // Retrieve existing campaigns for this year
  let campaigns = JSON.parse(localStorage.getItem(`campaigns_${year}`)) || [];

  // Push the new campaign object
  campaigns.push({
    brand,
    saleMonth,
    campaignName,
    campaignType,
    pageLocation,
    startDate,       // Store in ISO (YYYY-MM-DD)
    endDate,         // Store in ISO (YYYY-MM-DD)
    engagementNotes,
    imageUrl
  });

  // Save updated array back to localStorage
  localStorage.setItem(`campaigns_${year}`, JSON.stringify(campaigns));

  // Refresh the display
  displayCampaigns(year);
}

// 5. DATE FORMATTER - Converts "YYYY-MM-DD" to "DD/MM/YYYY"
function formatDateToDMY(isoString) {
  if (!isoString) return "";
  // isoString is typically "2025-02-06"
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`; // e.g. "06/02/2025"
}

// 6. DISPLAY CAMPAIGNS - Populate the table
function displayCampaigns(year) {
  const campaignTableBody = document.querySelector("#campaignTable tbody");
  campaignTableBody.innerHTML = "";

  // Load campaigns from localStorage
  const campaigns = JSON.parse(localStorage.getItem(`campaigns_${year}`)) || [];

  // If no campaigns, show a placeholder row
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
      <!-- Use our formatDateToDMY() for display -->
      <td>${formatDateToDMY(campaign.startDate)}</td>
      <td>${formatDateToDMY(campaign.endDate)}</td>
      <td>${campaign.engagementNotes || ""}</td>
      <td>
        ${
          campaign.imageUrl
            ? `<img src="${campaign.imageUrl}" width="50" alt="Campaign Image" onclick="openImage('${campaign.imageUrl}')">
               <br>
               <a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a>`
            : "No image"
        }
      </td>
      <td>
        <button onclick="editCampaign(${index}, '${year}')">✏️ Edit</button>
        <button class="delete-btn" onclick="deleteCampaign(${index}, '${year}')">❌ Delete</button>
      </td>
    `;

    campaignTableBody.appendChild(row);
  });
}

// 7. DELETE CAMPAIGN
function deleteCampaign(index, year) {
  let campaigns = JSON.parse(localStorage.getItem(`campaigns_${year}`)) || [];
  campaigns.splice(index, 1);
  localStorage.setItem(`campaigns_${year}`, JSON.stringify(campaigns));
  displayCampaigns(year);
}

// 8. EDIT CAMPAIGN - Inline editing of an existing row
function editCampaign(index, year) {
  let campaigns = JSON.parse(localStorage.getItem(`campaigns_${year}`)) || [];
  const campaign = campaigns[index];

  const campaignTableBody = document.querySelector("#campaignTable tbody");
  // Each row is rendered in order, so the row we want is .rows[index]
  const row = campaignTableBody.rows[index];

  // Replace the row’s cells with input fields, including an image input for editing the image
  row.innerHTML = `
    <td><input type="text" id="editBrand${index}" value="${campaign.brand || ""}"></td>
    <td><input type="text" id="editSaleMonth${index}" value="${campaign.saleMonth || ""}"></td>
    <td><input type="text" id="editCampaignName${index}" value="${campaign.campaignName || ""}"></td>
    <td><input type="text" id="editCampaignType${index}" value="${campaign.campaignType || ""}"></td>
    <td><input type="text" id="editPageLocation${index}" value="${campaign.pageLocation || ""}"></td>
    <!-- For the date inputs, keep the stored ISO format so the date picker works properly -->
    <td><input type="date" id="editStartDate${index}" value="${campaign.startDate || ""}"></td>
    <td><input type="date" id="editEndDate${index}" value="${campaign.endDate || ""}"></td>
    <td><input type="text" id="editEngagementNotes${index}" value="${campaign.engagementNotes || ""}"></td>
    <td>
      <img class="editImagePreview" src="${campaign.imageUrl || ''}" width="50" alt="Campaign Image">
      <br>
      <input type="file" id="editImage${index}" class="editImageInput" accept="image/*" style="display: none;" onchange="updateEditImagePreview(${index}, this)">
      <button type="button" onclick="triggerEditImage(this)">Change Image</button>
      <br>
      ${
        campaign.imageUrl 
          ? `<a href="${campaign.imageUrl}" download="campaign-image.png" class="download-btn">Download</a>` 
          : ""
      }
    </td>
    <td>
      <button onclick="saveEditedCampaign(${index}, '${year}')">💾 Save</button>
      <button onclick="cancelEdit('${year}')">Cancel</button>
    </td>
  `;
}

// New function: Trigger the file input in edit mode
function triggerEditImage(button) {
  const row = button.closest("tr");
  const fileInput = row.querySelector(".editImageInput");
  if (fileInput) {
    fileInput.click();
  }
}

// New function: Update the preview image when a new file is selected in edit mode
function updateEditImagePreview(index, inputElement) {
  const file = inputElement.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      // Find the corresponding preview image and update its src attribute
      const row = inputElement.closest("tr");
      const preview = row.querySelector(".editImagePreview");
      if (preview) {
        preview.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}

// 9. SAVE EDITED CAMPAIGN
function saveEditedCampaign(index, year) {
  let campaigns = JSON.parse(localStorage.getItem(`campaigns_${year}`)) || [];
  const updated = campaigns[index];

  // Update campaign details from input fields
  updated.brand = document.getElementById(`editBrand${index}`).value;
  updated.saleMonth = document.getElementById(`editSaleMonth${index}`).value;
  updated.campaignName = document.getElementById(`editCampaignName${index}`).value;
  updated.campaignType = document.getElementById(`editCampaignType${index}`).value;
  updated.pageLocation = document.getElementById(`editPageLocation${index}`).value;
  updated.startDate = document.getElementById(`editStartDate${index}`).value; // still ISO
  updated.endDate = document.getElementById(`editEndDate${index}`).value;     // still ISO
  updated.engagementNotes = document.getElementById(`editEngagementNotes${index}`).value;

  // Handle updated image if a new file was selected
  const imageInput = document.getElementById(`editImage${index}`);
  if (imageInput && imageInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = function(e) {
      updated.imageUrl = e.target.result;
      // Save the updated campaign array to localStorage after image is processed
      localStorage.setItem(`campaigns_${year}`, JSON.stringify(campaigns));
      displayCampaigns(year);
    };
    reader.readAsDataURL(imageInput.files[0]);
  } else {
    // No new image selected; save other changes immediately
    localStorage.setItem(`campaigns_${year}`, JSON.stringify(campaigns));
    displayCampaigns(year);
  }
}

// 10. CANCEL EDIT - just re-displays the table without saving changes
function cancelEdit(year) {
  displayCampaigns(year);
}

// 11. OPEN IMAGE IN NEW TAB
function openImage(url) {
  window.open(url, "_blank");
}

// 12. DEFAULT YEAR ON LOAD
window.onload = function () {
  showYear("2024");
};
