import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('repair', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to manage metadata repairs.</p>
            </div>
        `;
    }
    
    // Load references for dropdown
    let references = [];
    try {
        references = await apiRequest(`/api/references?project_id=${state.activeProjectId}`);
    } catch(e) {}
    
    // Check if ID passed in hash params
    const hashParams = new URLSearchParams(location.hash.split("?")[1] || "");
    const selectedId = hashParams.get("id") || "";
    
    const optionsHTML = references.map(r => `
        <option value="${r.id}" ${r.id == selectedId ? 'selected' : ''}>
            ID ${r.id}: ${r.title ? r.title.slice(0, 50) + "..." : "Untitled"} (${r.year || "n.d."})
        </option>
    `).join("");
    
    return `
        <h2>Metadata Repair Center</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Audits cross-referenced academic database logs to find and repair missing registry metadata (DOIs, page ranges, publisher details).</p>
        
        <!-- Selection header -->
        <div class="card" style="display: flex; gap: 16px; align-items: center; padding: 16px;">
            <div style="flex: 2; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Select Reference to Audit</label>
                <select id="repair-select-ref" class="form-input" style="padding: 8px;">
                    <option value="">-- Choose a Reference --</option>
                    ${optionsHTML}
                </select>
            </div>
            <button id="run-repair-btn" class="btn btn-primary" style="height: 38px; align-self: flex-end;">
                <i class="fa-solid fa-circle-nodes"></i> Scan Registry Logs
            </button>
        </div>
        
        <!-- Repair Comparison Grid (Hidden initially) -->
        <div id="repair-comparison-card" class="card hidden">
            <div class="card-header">
                <div>
                    <h4>Registry Metadata Diff Audit</h4>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;" id="repair-source-label"></p>
                </div>
                <button class="btn btn-success btn-sm" id="apply-repairs-btn">Apply Selected Repairs</button>
            </div>
            
            <div class="table-container">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">Apply</th>
                            <th>Field Name</th>
                            <th>Current Library Value</th>
                            <th>Registry Match Value</th>
                            <th>Status Badge</th>
                        </tr>
                    </thead>
                    <tbody id="repair-tbody"></tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 8px; background-color: var(--bg-sidebar); padding: 16px; border-radius: 8px;">
                <h5 style="color: var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> Academic Writing Quality Rule</h5>
                <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                    Verify all field changes before updating database records. CiteGuard will recalculate the Metadata Quality Score based on the updated fields.
                </p>
            </div>
        </div>
    `;
}, async () => {
    const select = document.getElementById("repair-select-ref");
    const scanBtn = document.getElementById("run-repair-btn");
    const compCard = document.getElementById("repair-comparison-card");
    const tbody = document.getElementById("repair-tbody");
    const sourceLabel = document.getElementById("repair-source-label");
    const applyBtn = document.getElementById("apply-repairs-btn");
    
    if (!scanBtn) return;
    
    let activeRefId = select.value;
    let repairedMetadataPayload = {};
    let currentReferenceData = {};
    
    // Auto-run if selection is preset
    if (activeRefId) {
        runScanner(activeRefId);
    }
    
    select.addEventListener("change", (e) => {
        activeRefId = e.target.value;
        compCard.classList.add("hidden");
    });
    
    scanBtn.addEventListener("click", () => {
        if (!activeRefId) {
            showToast("Please choose a reference first.", "warning");
            return;
        }
        runScanner(activeRefId);
    });
    
    async function runScanner(id) {
        try {
            showToast("Querying metadata registries...");
            // Get current reference details
            currentReferenceData = await apiRequest(`/api/references/${id}`);
            // Run repair lookup
            const repairResult = await apiRequest(`/api/references/${id}/repair-metadata`, { method: "POST" });
            
            if (repairResult.status === "no_updates" || !repairResult.repaired_data) {
                showToast("Reference details match registry logs. No repairs required.", "info");
                compCard.classList.add("hidden");
                return;
            }
            
            repairedMetadataPayload = repairResult.repaired_data;
            sourceLabel.textContent = `Registry source: ${repairResult.source} (Confidence: ${(repairResult.confidence * 100).toFixed(0)}%)`;
            
            // Generate list of fields to compare
            const fieldsList = ["title", "authors", "year", "doi", "container_title", "publisher", "volume", "issue", "pages", "abstract"];
            tbody.innerHTML = "";
            
            fieldsList.forEach(field => {
                const curVal = currentReferenceData[field] || "";
                const repVal = repairedMetadataPayload[field] || "";
                
                let statusBadge = `<span class="badge badge-success">Match</span>`;
                let isDifferent = false;
                
                if (!curVal && repVal) {
                    statusBadge = `<span class="badge badge-warning">Missing Filled</span>`;
                    isDifferent = true;
                } else if (curVal && repVal && String(curVal).trim().lower() !== String(repVal).trim().lower()) {
                    statusBadge = `<span class="badge badge-danger">Conflict</span>`;
                    isDifferent = true;
                } else if (!repVal) {
                    statusBadge = `<span class="badge badge-info">No Registry Data</span>`;
                }
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="text-align: center;">
                        <input type="checkbox" class="repair-checkbox" data-field="${field}" ${isDifferent ? 'checked' : 'disabled'}>
                    </td>
                    <td style="font-weight: 600; text-transform: capitalize;">${field.replace("_", " ")}</td>
                    <td style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${curVal || '<span style="color: var(--text-muted); font-style: italic;">empty</span>'}</td>
                    <td style="color: var(--accent); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${repVal || '—'}</td>
                    <td>${statusBadge}</td>
                `;
                tbody.appendChild(tr);
            });
            
            compCard.classList.remove("hidden");
            
        } catch(e) {}
    }
    
    applyBtn.addEventListener("click", async () => {
        const checkboxes = document.querySelectorAll(".repair-checkbox:checked");
        const patchData = { ...currentReferenceData };
        
        checkboxes.forEach(cb => {
            const field = cb.getAttribute("data-field");
            patchData[field] = repairedMetadataPayload[field];
        });
        
        try {
            await apiRequest(`/api/references/${activeRefId}`, {
                method: "PATCH",
                body: patchData
            });
            
            showToast("Registry repairs applied to reference.");
            compCard.classList.add("hidden");
            // Redirect back or reload dropdown
            location.hash = "#references";
        } catch(e) {}
    });
});
