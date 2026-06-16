import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('import', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project Selected</h3>
                <p>Please select a project to import references into.</p>
            </div>
        `;
    }
    
    return `
        <h2>Import References</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Import existing bibliography catalogs (.bib, .ris) or extract metadata from PDF papers.</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-top: 16px;">
            
            <!-- BibTeX & RIS Import Card -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 280px;">
                <div>
                    <div class="card-header">
                        <h4><i class="fa-solid fa-file-code" style="color: var(--accent);"></i> Bibliography File Import</h4>
                    </div>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                        Upload standardized BibTeX (.bib) or Research Information Systems (.ris) files. All metadata fields will be mapped and stored.
                    </p>
                    
                    <form id="file-catalog-form">
                        <div class="form-group">
                            <label>File Type Selection</label>
                            <select id="import-catalog-type" class="form-input" style="padding: 8px;">
                                <option value="bibtex">BibTeX (.bib)</option>
                                <option value="ris">RIS (.ris)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="catalog-file-input">Choose Bibliography File</label>
                            <input type="file" id="catalog-file-input" required class="form-input" style="padding: 6px;">
                        </div>
                    </form>
                </div>
                <button type="submit" form="file-catalog-form" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Upload Catalog
                </button>
            </div>
            
            <!-- PDF Metadata Extraction Card -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 280px;">
                <div>
                    <div class="card-header">
                        <h4><i class="fa-solid fa-file-pdf" style="color: var(--danger);"></i> PDF Metadata Extractor</h4>
                    </div>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                        Upload a research paper PDF. The system parses structural text layers to extract the title, authors, DOI, and abstract context automatically.
                    </p>
                    
                    <form id="file-pdf-form">
                        <div class="form-group">
                            <label for="pdf-file-input">Choose Research PDF</label>
                            <input type="file" id="pdf-file-input" required accept=".pdf" class="form-input" style="padding: 6px;">
                        </div>
                    </form>
                </div>
                <button type="submit" form="file-pdf-form" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Extract PDF Metadata
                </button>
            </div>
            
        </div>
        
        <!-- Import Progress / Results Pane -->
        <div id="import-results-card" class="card hidden">
            <div class="card-header">
                <h4>Extraction Audit Results</h4>
                <button class="btn btn-secondary btn-sm" id="clear-results-btn">Dismiss</button>
            </div>
            <div id="import-results-body"></div>
        </div>
    `;
}, async () => {
    const catalogForm = document.getElementById("file-catalog-form");
    const pdfForm = document.getElementById("file-pdf-form");
    const resultsCard = document.getElementById("import-results-card");
    const resultsBody = document.getElementById("import-results-body");
    const clearBtn = document.getElementById("clear-results-btn");
    
    if (clearBtn) {
        clearBtn.addEventListener("click", () => resultsCard.classList.add("hidden"));
    }
    
    // 1. Catalog Import Handlers
    if (catalogForm) {
        catalogForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById("catalog-file-input");
            const type = document.getElementById("import-catalog-type").value;
            
            if (!fileInput.files || fileInput.files.length === 0) return;
            const file = fileInput.files[0];
            
            const fd = new FormData();
            fd.append("project_id", state.activeProjectId);
            fd.append("file", file);
            
            const endpoint = type === "bibtex" ? "/api/references/import/bibtex" : "/api/references/import/ris";
            
            try {
                showToast("Uploading bibliography catalog...");
                const res = await apiRequest(endpoint, {
                    method: "POST",
                    body: fd
                });
                
                showToast(`Successfully imported ${res.imported} references!`);
                catalogForm.reset();
                
                resultsCard.classList.remove("hidden");
                resultsBody.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px; color: var(--success);">
                        <i class="fa-solid fa-circle-check" style="font-size: 24px;"></i>
                        <div>
                            <strong>Import Complete</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Loaded ${res.imported} records into project reference index. Go to Reference Library to view details.</p>
                        </div>
                    </div>
                `;
            } catch(err) {
                // Toasts handled globally
            }
        });
    }
    
    // 2. PDF Metadata Extraction Handlers
    if (pdfForm) {
        pdfForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById("pdf-file-input");
            
            if (!fileInput.files || fileInput.files.length === 0) return;
            const file = fileInput.files[0];
            
            const fd = new FormData();
            fd.append("project_id", state.activeProjectId);
            fd.append("file", file);
            
            try {
                showToast("Extracting PDF text layer...");
                const res = await apiRequest("/api/references/import/pdf", {
                    method: "POST",
                    body: fd
                });
                
                showToast("PDF metadata extracted.");
                pdfForm.reset();
                
                resultsCard.classList.remove("hidden");
                
                const scannedWarning = res.scanned_detected ? `
                    <div class="badge badge-warning" style="margin-top: 8px; font-size: 12px; border-radius: 4px; padding: 6px 12px; display: flex;">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>OCR Needed: This PDF appears scanned or image-only. OCR support is required for full-text claim verification.</span>
                    </div>
                ` : `
                    <div class="badge badge-success" style="margin-top: 8px; font-size: 12px; border-radius: 4px; padding: 6px 12px; display: flex;">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>Selectable text successfully extracted (${res.pages} pages). Text matches index mapping.</span>
                    </div>
                `;
                
                resultsBody.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px; color: var(--text-primary);">
                            <i class="fa-solid fa-file-invoice" style="font-size: 24px; color: var(--accent);"></i>
                            <div>
                                <strong>Extracted: ${res.title || "Untitled PDF Reference"}</strong>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Assigned Reference ID: ${res.reference_id}</p>
                            </div>
                        </div>
                        ${scannedWarning}
                    </div>
                `;
            } catch(err) {
                // Toasts handled globally
            }
        });
    }
});
