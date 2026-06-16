import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('duplicates', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to scan for duplicate references.</p>
            </div>
        `;
    }
    
    return `
        <h2>Duplicate Reference Detector</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Scans DOI keys, URL domains, and fuzzy title words to detect redundant references. Merging transfers files and annotations onto a single verified canonical record.</p>
        
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-top: 16px;">
            <div>
                <h4>Duplicate Scanning Tool</h4>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Press scan to search for overlaps. CiteGuard never deletes or merges duplicates automatically.</p>
            </div>
            <button id="scan-duplicates-btn" class="btn btn-primary">
                <i class="fa-solid fa-clone"></i> Scan For Duplicates
            </button>
        </div>
        
        <!-- Results Container -->
        <div id="duplicates-empty-box" style="text-align: center; padding: 60px 0; color: var(--text-muted);">
            <i class="fa-solid fa-binoculars" style="font-size: 48px; margin-bottom: 16px;"></i>
            <p>Click 'Scan For Duplicates' to discover catalog redundancy.</p>
        </div>
        
        <div id="duplicates-list-container" class="hidden" style="display: flex; flex-direction: column; gap: 24px;">
            <!-- Dynamic duplicate group cards -->
        </div>
    `;
}, async () => {
    const scanBtn = document.getElementById("scan-duplicates-btn");
    const emptyBox = document.getElementById("duplicates-empty-box");
    const listContainer = document.getElementById("duplicates-list-container");
    
    if (!scanBtn) return;
    
    scanBtn.addEventListener("click", async () => {
        try {
            showToast("Searching for library overlaps...");
            const fd = new FormData();
            fd.append("project_id", state.activeProjectId);
            
            const groups = await apiRequest("/api/duplicates/find", {
                method: "POST",
                body: fd
            });
            
            emptyBox.classList.add("hidden");
            listContainer.classList.remove("hidden");
            listContainer.innerHTML = "";
            
            if (groups.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--success);" class="card">
                        <i class="fa-solid fa-circle-check" style="font-size: 32px; margin-bottom: 12px;"></i>
                        <h4>Library is Clean</h4>
                        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">No duplicate references found in this project library.</p>
                    </div>
                `;
                return;
            }
            
            groups.forEach(group => {
                const card = document.createElement("div");
                card.className = "card";
                card.id = `dupe-card-${group.group_id}`;
                card.style.borderColor = "var(--danger)";
                
                // Construct items checklist HTML
                const itemsHTML = group.references.map((r, i) => `
                    <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: var(--accent);">Candidate #${i+1} (ID: ${r.id})</span>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                                <input type="radio" name="keep-canonical-${group.group_id}" value="${r.id}" ${i === 0 ? 'checked' : ''}> Set Canonical
                            </label>
                        </div>
                        <h5 style="color: var(--text-primary);">${r.title || 'Untitled'}</h5>
                        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                            <strong>Authors:</strong> ${r.authors || 'Unknown'}<br>
                            <strong>Year:</strong> ${r.year || 'n.d.'}<br>
                            <strong>DOI:</strong> ${r.doi || '—'}<br>
                            <strong>Journal/Venue:</strong> ${r.container_title || r.journal || '—'}
                        </div>
                    </div>
                `).join("");
                
                card.innerHTML = `
                    <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
                        <div>
                            <span class="badge badge-danger" style="margin-bottom: 4px;">Match: ${(group.confidence_score * 100).toFixed(0)}%</span>
                            <h4>${group.reason}</h4>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary btn-sm ignore-dupe-btn" data-id="${group.group_id}">Ignore</button>
                            <button class="btn btn-danger btn-sm merge-dupe-btn" data-id="${group.group_id}">Merge Duplicates</button>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        ${itemsHTML}
                    </div>
                    
                    <div style="margin-top: 14px; font-size: 12px; color: var(--text-muted);">
                        <strong>Conflicting metadata fields:</strong> ${group.metadata_diffs.length > 0 ? group.metadata_diffs.join(", ") : "None (exact values matches)"}
                    </div>
                `;
                listContainer.appendChild(card);
            });
            
            // Bind Merge and Ignore actions
            bindDuplicateActions();
            showToast(`Scanned references, found ${groups.length} duplicate groups.`);
            
        } catch(e) {}
    });
    
    function bindDuplicateActions() {
        document.querySelectorAll(".ignore-dupe-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                try {
                    await apiRequest(`/api/duplicates/${id}/ignore`, { method: "POST" });
                    showToast("Duplicate group ignored.");
                    document.getElementById(`dupe-card-${id}`).remove();
                } catch(err) {}
            });
        });
        
        document.querySelectorAll(".merge-dupe-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                const card = document.getElementById(`dupe-card-${id}`);
                
                // Get selected canonical ID
                const canonicalRadio = card.querySelector(`input[name="keep-canonical-${id}"]:checked`);
                const keepId = parseInt(canonicalRadio.value);
                
                // Find target duplicate ID to remove (any ID in card radios that is not keepId)
                const radios = card.querySelectorAll(`input[name="keep-canonical-${id}"]`);
                let removeId = null;
                radios.forEach(r => {
                    const rVal = parseInt(r.value);
                    if (rVal !== keepId) {
                        removeId = rVal;
                    }
                });
                
                if (!removeId) {
                    showToast("Cannot merge single records.", "warning");
                    return;
                }
                
                try {
                    const fd = new FormData();
                    fd.append("keep_reference_id", keepId);
                    fd.append("remove_reference_id", removeId);
                    
                    await apiRequest(`/api/duplicates/${id}/merge`, {
                        method: "POST",
                        body: fd
                    });
                    
                    showToast("References merged successfully.");
                    card.remove();
                } catch(err) {}
            });
        });
    }
});
