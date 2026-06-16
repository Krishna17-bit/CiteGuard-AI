import { registerPage, apiRequest, showToast } from '../app.js';

registerPage('cleaner', async () => {
    return `
        <h2>BibTeX Cleaner</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Upload LaTeX BibTeX databases to detect syntax warnings, duplicate cite keys, and brace-wrap acronyms automatically.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: File Upload -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; align-self: flex-start;">
                <div class="card-header">
                    <h4>Upload BibTeX Database</h4>
                </div>
                
                <form id="bibtex-cleaner-form">
                    <div class="form-group">
                        <label for="cleaner-file-input">Choose .bib File</label>
                        <input type="file" id="cleaner-file-input" required accept=".bib" class="form-input" style="padding: 6px;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">
                        <i class="fa-solid fa-broom"></i> Scan & Clean BibTeX
                    </button>
                </form>
                
                <!-- Warnings check box -->
                <div id="cleaner-warnings-box" class="hidden" style="display: flex; flex-direction: column; gap: 10px;">
                    <h5>Syntax Warnings Found</h5>
                    <div id="cleaner-warnings-list" style="overflow-y: auto; max-height: 250px; display: flex; flex-direction: column; gap: 8px;">
                        <!-- Warnings go here -->
                    </div>
                </div>
            </div>
            
            <!-- Right Panel: Cleaned Output -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 400px;">
                <div>
                    <div class="card-header">
                        <h4>Cleaned BibTeX Output</h4>
                        <div style="display: flex; gap: 8px;" id="cleaner-actions-wrapper" class="hidden">
                            <button class="btn btn-secondary btn-sm" id="copy-clean-bib-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                            <button class="btn btn-secondary btn-sm" id="download-clean-bib-btn"><i class="fa-solid fa-download"></i> Download</button>
                        </div>
                    </div>
                    
                    <textarea id="cleaned-bibtex-textarea" readonly class="form-input" style="height: 350px; font-family: monospace; font-size: 12.5px; background-color: var(--bg-sidebar); line-height: 1.5;" placeholder="Upload a .bib file and clean to view formatted code..."></textarea>
                </div>
            </div>
        </div>
    `;
}, async () => {
    const form = document.getElementById("bibtex-cleaner-form");
    const warningsBox = document.getElementById("cleaner-warnings-box");
    const warningsList = document.getElementById("cleaner-warnings-list");
    const actionsWrapper = document.getElementById("cleaner-actions-wrapper");
    const textarea = document.getElementById("cleaned-bibtex-textarea");
    const copyBtn = document.getElementById("copy-clean-bib-btn");
    const downloadBtn = document.getElementById("download-clean-bib-btn");
    
    if (!form) return;
    
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("cleaner-file-input");
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        
        const fd = new FormData();
        fd.append("file", file);
        
        try {
            showToast("Cleaning BibTeX entries...");
            const res = await apiRequest("/api/bibtex/clean", {
                method: "POST",
                body: fd
            });
            
            // Populate output
            textarea.value = res.cleaned_bibtex;
            actionsWrapper.classList.remove("hidden");
            
            // Populate warnings
            warningsList.innerHTML = "";
            if (res.warnings.length === 0) {
                warningsBox.classList.add("hidden");
                showToast("BibTeX database is perfectly clean! No warnings.");
            } else {
                warningsBox.classList.remove("hidden");
                res.warnings.forEach(w => {
                    const alertDiv = document.createElement("div");
                    alertDiv.style.backgroundColor = w.severity === 'critical' || w.severity === 'high' ? 'var(--danger-glow)' : 'var(--warning-glow)';
                    alertDiv.style.border = `1px solid ${w.severity === 'critical' || w.severity === 'high' ? 'hsla(355, 85%, 55%, 0.3)' : 'hsla(38, 92%, 50%, 0.3)'}`;
                    alertDiv.style.borderRadius = "6px";
                    alertDiv.style.padding = "8px 12px";
                    alertDiv.style.fontSize = "12px";
                    alertDiv.style.color = w.severity === 'critical' || w.severity === 'high' ? 'var(--danger)' : 'var(--warning)';
                    
                    alertDiv.innerHTML = `
                        <strong><i class="fa-solid fa-circle-exclamation"></i> ${w.type.toUpperCase()}</strong>
                        <p style="color: var(--text-primary); margin-top: 2px;">${w.message}</p>
                    `;
                    warningsList.appendChild(alertDiv);
                });
                showToast("Cleaned. Warnings checklist updated.");
            }
            
        } catch(err) {}
    });
    
    copyBtn.addEventListener("click", () => {
        if (!textarea.value) return;
        navigator.clipboard.writeText(textarea.value);
        showToast("Cleaned BibTeX copied.");
    });
    
    downloadBtn.addEventListener("click", () => {
        if (!textarea.value) return;
        const blob = new Blob([textarea.value], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cleaned_bibliography.bib";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Cleaned BibTeX downloaded.");
    });
});
