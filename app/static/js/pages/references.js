import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('references', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to view its reference library.</p>
            </div>
        `;
    }
    
    try {
        state.references = await apiRequest(`/api/references?project_id=${state.activeProjectId}`);
    } catch(e) {
        state.references = [];
    }
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2>Reference Library</h2>
                <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Search, edit, verify metadata, and organize your manuscript bibliographies.</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" onclick="location.hash='#import'">
                    <i class="fa-solid fa-file-import"></i> Import Files
                </button>
            </div>
        </div>
        
        <!-- Search & Filter Controls -->
        <div class="card" style="display: flex; flex-direction: row; gap: 16px; align-items: center; padding: 16px;">
            <div style="flex: 2; display: flex; align-items: center; background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px;">
                <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted); margin-right: 10px;"></i>
                <input type="text" id="lib-search-input" placeholder="Search references..." style="background: none; border: none; outline: none; color: var(--text-primary); width: 100%; font-size: 14px;">
            </div>
            
            <div style="flex: 1;">
                <select id="lib-filter-type" class="form-input" style="padding: 8px 12px;">
                    <option value="">All Source Types</option>
                    <option value="journal article">Journal Articles</option>
                    <option value="conference paper">Conference Papers</option>
                    <option value="book">Books</option>
                    <option value="book chapter">Book Chapters</option>
                    <option value="thesis">Theses</option>
                    <option value="report">Technical Reports</option>
                    <option value="preprint">Preprints</option>
                    <option value="website">Websites</option>
                </select>
            </div>
            
            <div style="flex: 1;">
                <select id="lib-filter-quality" class="form-input" style="padding: 8px 12px;">
                    <option value="">All Qualities</option>
                    <option value="missing_doi">Missing DOI</option>
                    <option value="missing_year">Missing Year</option>
                    <option value="low_quality">Low Quality (&lt; 70%)</option>
                </select>
            </div>
        </div>
        
        <!-- Table Card -->
        <div class="card">
            <div class="table-container">
                <table class="custom-table" id="references-table">
                    <thead>
                        <tr>
                            <th>Quality</th>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Venue</th>
                            <th>Year</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="references-tbody">
                        ${renderTableRows(state.references)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}, async () => {
    const tbody = document.getElementById("references-tbody");
    const searchInput = document.getElementById("lib-search-input");
    const typeFilter = document.getElementById("lib-filter-type");
    const qualityFilter = document.getElementById("lib-filter-quality");
    
    if (!tbody) return;
    
    // Filtering logic function
    const applyFilters = () => {
        const query = searchInput.value.toLowerCase().trim();
        const type = typeFilter.value;
        const quality = qualityFilter.value;
        
        let filtered = [...state.references];
        
        if (query) {
            filtered = filtered.filter(r => 
                (r.title && r.title.toLowerCase().includes(query)) ||
                (r.authors && r.authors.toLowerCase().includes(query)) ||
                (r.doi && r.doi.toLowerCase().includes(query))
            );
        }
        
        if (type) {
            filtered = filtered.filter(r => r.source_type === type);
        }
        
        if (quality) {
            if (quality === "missing_doi") {
                filtered = filtered.filter(r => !r.doi);
            } else if (quality === "missing_year") {
                filtered = filtered.filter(r => !r.year);
            } else if (quality === "low_quality") {
                filtered = filtered.filter(r => (r.metadata_quality_score || 100) < 70);
            }
        }
        
        tbody.innerHTML = renderTableRows(filtered);
        bindRowActions();
    };
    
    searchInput.addEventListener("input", applyFilters);
    typeFilter.addEventListener("change", applyFilters);
    qualityFilter.addEventListener("change", applyFilters);
    
    bindRowActions();
});

function renderTableRows(references) {
    if (references.length === 0) {
        return `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                    No references match the active search filters.
                </td>
            </tr>
        `;
    }
    
    return references.map(r => {
        const score = r.metadata_quality_score || 100;
        let badgeColor = "badge-success";
        if (score < 50) badgeColor = "badge-danger";
        else if (score < 75) badgeColor = "badge-warning";
        
        return `
            <tr id="row-${r.id}">
                <td><span class="badge ${badgeColor}">${score}%</span></td>
                <td style="font-weight: 600; max-width: 280px; text-overflow: ellipsis; overflow: hidden;" title="${r.title || ''}">${r.title || 'Untitled'}</td>
                <td style="color: var(--text-secondary); max-width: 180px; text-overflow: ellipsis; overflow: hidden;" title="${r.authors || ''}">${r.authors || 'Unknown'}</td>
                <td style="color: var(--text-muted); font-style: italic;">${r.container_title || r.journal || '—'}</td>
                <td>${r.year || '—'}</td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm copy-cite-btn" data-id="${r.id}" title="Copy Citation (APA)">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm notes-btn" data-id="${r.id}" title="Add/View Notes">
                        <i class="fa-solid fa-note-sticky"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm repair-btn" data-id="${r.id}" title="Metadata Repair">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                    </button>
                    <button class="btn btn-danger btn-sm delete-ref-btn" data-id="${r.id}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
            <tr id="notes-row-${r.id}" class="notes-row hidden" style="background-color: var(--bg-sidebar);">
                <td colspan="6">
                    <div style="padding: 16px; border: 1px dashed var(--border-color); border-radius: 8px; margin: 4px 0;">
                        <h5>Research Notes & Tags for Reference ID ${r.id}</h5>
                        
                        <div style="display: flex; gap: 16px; margin-top: 12px;">
                            <!-- Notes list -->
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;" id="notes-list-${r.id}">
                                <div style="color: var(--text-muted); font-size: 13px;">Loading notes...</div>
                            </div>
                            
                            <!-- Add note form -->
                            <div style="flex: 1; border-left: 1px solid var(--border-color); padding-left: 16px; align-self: flex-start;">
                                <form id="add-note-form-${r.id}" style="display: flex; flex-direction: column; gap: 8px;">
                                    <input type="hidden" name="ref_id" value="${r.id}">
                                    <div style="display: flex; gap: 8px;">
                                        <select name="note_type" class="form-input" style="padding: 6px; font-size: 12px; width: auto; flex: 1;">
                                            <option value="summary">Summary</option>
                                            <option value="method">Methodology</option>
                                            <option value="result">Key Findings</option>
                                            <option value="limitation">Limitations</option>
                                            <option value="manual note">Manual Note</option>
                                        </select>
                                        <input type="text" name="tags" placeholder="Tags (comma-separated)" class="form-input" style="padding: 6px; font-size: 12px; flex: 1;">
                                    </div>
                                    <textarea name="content" placeholder="Add study annotation details..." required rows="2" class="form-input" style="padding: 8px; font-size: 13px;"></textarea>
                                    <button type="submit" class="btn btn-primary btn-sm" style="align-self: flex-end;">
                                        <i class="fa-solid fa-check"></i> Add Note
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function bindRowActions() {
    // Delete Reference actions
    document.querySelectorAll(".delete-ref-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            if (!confirm("Are you sure you want to delete this reference from library?")) return;
            
            try {
                await apiRequest(`/api/references/${id}`, { method: "DELETE" });
                showToast("Reference deleted.");
                
                // Remove rows from DOM
                const row = document.getElementById(`row-${id}`);
                const notesRow = document.getElementById(`notes-row-${id}`);
                if (row) row.remove();
                if (notesRow) notesRow.remove();
                
                // Update internal state list
                state.references = state.references.filter(r => r.id != id);
            } catch(e) {}
        });
    });
    
    // Copy Citation API format
    document.querySelectorAll(".copy-cite-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            try {
                const formatted = await apiRequest("/api/citations/format", {
                    method: "POST",
                    body: { references_ids: [parseInt(id)], style: "apa" }
                });
                if (formatted && formatted.length > 0) {
                    navigator.clipboard.writeText(formatted[0].bibliography_text);
                    showToast("APA citation copied to clipboard.");
                }
            } catch(err) {}
        });
    });
    
    // Metadata Repair link redirect
    document.querySelectorAll(".repair-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            location.hash = `#repair?id=${id}`;
        });
    });
    
    // Notes Drawer toggle action
    document.querySelectorAll(".notes-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            const drawer = document.getElementById(`notes-row-${id}`);
            if (!drawer) return;
            
            const isHidden = drawer.classList.contains("hidden");
            if (isHidden) {
                drawer.classList.remove("hidden");
                // Load notes
                loadNotesForReference(id);
                // Bind submit listener once
                const form = document.getElementById(`add-note-form-${id}`);
                if (form && !form.dataset.bound) {
                    form.dataset.bound = "true";
                    form.addEventListener("submit", async (ev) => {
                        ev.preventDefault();
                        const fd = new FormData(form);
                        try {
                            await apiRequest("/api/notes", { method: "POST", body: fd });
                            showToast("Note added successfully.");
                            form.reset();
                            loadNotesForReference(id);
                        } catch(err) {}
                    });
                }
            } else {
                drawer.classList.add("hidden");
            }
        });
    });
}

async function loadNotesForReference(refId) {
    const listContainer = document.getElementById(`notes-list-${refId}`);
    if (!listContainer) return;
    
    try {
        const notes = await apiRequest(`/api/notes?reference_id=${refId}`);
        listContainer.innerHTML = "";
        
        if (notes.length === 0) {
            listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No notes or tags added yet.</div>`;
            return;
        }
        
        notes.forEach(n => {
            const noteDiv = document.createElement("div");
            noteDiv.style.backgroundColor = "var(--bg-main)";
            noteDiv.style.padding = "10px";
            noteDiv.style.borderRadius = "6px";
            noteDiv.style.border = "1px solid var(--border-color)";
            noteDiv.style.fontSize = "13px";
            
            const tagsHTML = n.tags ? n.tags.split(",").map(t => `<span class="badge badge-info" style="font-size: 9px; padding: 1px 6px; margin-right: 4px;">${t.strip()}</span>`).join("") : "";
            const created = new Date(n.created_at).toLocaleDateString();
            
            noteDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span class="badge badge-warning" style="text-transform: capitalize; font-size: 9px; padding: 2px 6px;">${n.note_type}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 11px;">${created}</span>
                        <button class="delete-note-btn" data-id="${n.id}" data-ref-id="${refId}" style="background: none; border: none; color: var(--danger); cursor: pointer;"><i class="fa-solid fa-trash-can" style="font-size: 11px;"></i></button>
                    </div>
                </div>
                <p style="color: var(--text-primary); font-size: 12.5px; line-height: 1.4; margin-bottom: 6px;">${n.content}</p>
                <div>${tagsHTML}</div>
            `;
            listContainer.appendChild(noteDiv);
        });
        
        // Bind note deletes
        listContainer.querySelectorAll(".delete-note-btn").forEach(delBtn => {
            delBtn.addEventListener("click", async (e) => {
                const noteId = e.currentTarget.getAttribute("data-id");
                try {
                    await apiRequest(`/api/notes/${noteId}`, { method: "DELETE" });
                    showToast("Note deleted.");
                    loadNotesForReference(refId);
                } catch(err) {}
            });
        });
        
    } catch(e) {
        listContainer.innerHTML = `<div class="text-danger">Failed to load notes.</div>`;
    }
}
