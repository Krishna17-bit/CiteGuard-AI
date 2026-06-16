import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('formatter', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to format citations.</p>
            </div>
        `;
    }
    
    let references = [];
    try {
        references = await apiRequest(`/api/references?project_id=${state.activeProjectId}`);
    } catch(e) {}
    
    const referenceCheckboxesHTML = references.map(r => `
        <div style="display: flex; gap: 10px; margin-bottom: 10px; font-size: 13px; align-items: flex-start;">
            <input type="checkbox" class="formatter-ref-cb" value="${r.id}" checked style="margin-top: 4px;">
            <div>
                <strong>${r.title || "Untitled"}</strong>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">${r.authors || "Unknown Authors"} (${r.year || "n.d."})</p>
            </div>
        </div>
    `).join("");
    
    return `
        <h2>Citation Formatter</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Convert, compare, and compile citations using publisher-certified CSL styling guidelines.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: Reference Selection & Style configs -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="card-header">
                    <h4>Configuration</h4>
                </div>
                
                <div class="form-group">
                    <label>Citation Style Preset</label>
                    <select id="formatter-style-select" class="form-input" style="padding: 8px;">
                        <option value="apa">APA 7th Edition</option>
                        <option value="mla">MLA 9th Edition</option>
                        <option value="chicago-author-date">Chicago Author-Date</option>
                        <option value="harvard">Harvard Style</option>
                        <option value="ieee">IEEE Numeric</option>
                        <option value="vancouver">Vancouver Numeric</option>
                        <option value="nature">Nature Journal</option>
                        <option value="ama">AMA Medical</option>
                        <option value="acs">ACS Chemical</option>
                    </select>
                </div>
                
                <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
                    <label style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Select Bibliography Records</span>
                        <span style="font-size: 11px; cursor: pointer; color: var(--accent);" id="formatter-toggle-all">Uncheck All</span>
                    </label>
                    <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; overflow-y: auto; max-height: 250px; background-color: var(--bg-main);" id="formatter-cb-container">
                        ${references.length === 0 ? '<p style="color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">No references available.</p>' : referenceCheckboxesHTML}
                    </div>
                </div>
                
                <button class="btn btn-primary" id="generate-bibliography-btn" style="width: 100%;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Bibliography
                </button>
            </div>
            
            <!-- Right Panel: Previews and Exports -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 400px;">
                <div>
                    <div class="card-header">
                        <h4>Bibliography Compiler Preview</h4>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary btn-sm" id="copy-bibliography-btn" title="Copy bibliography"><i class="fa-regular fa-copy"></i> Copy</button>
                            <button class="btn btn-secondary btn-sm" id="download-bibliography-btn" title="Download bibliography"><i class="fa-solid fa-download"></i> Export</button>
                        </div>
                    </div>
                    
                    <div style="background-color: var(--bg-sidebar); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6; min-height: 250px; overflow-y: auto; max-height: 350px; color: var(--text-primary);" id="bibliography-preview-box">
                        <p style="color: var(--text-muted); font-style: italic; text-align: center; margin-top: 80px;">Configure options and click 'Generate Bibliography' to inspect compiled reference previews.</p>
                    </div>
                </div>
                
                <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
                    <span>Copy supported formats: Plain Text, Markdown, and raw HTML lines.</span>
                </div>
            </div>
        </div>
    `;
}, async () => {
    const generateBtn = document.getElementById("generate-bibliography-btn");
    const styleSelect = document.getElementById("formatter-style-select");
    const previewBox = document.getElementById("bibliography-preview-box");
    const copyBtn = document.getElementById("copy-bibliography-btn");
    const exportBtn = document.getElementById("download-bibliography-btn");
    const toggleAll = document.getElementById("formatter-toggle-all");
    
    if (!generateBtn) return;
    
    let allChecked = true;
    if (toggleAll) {
        toggleAll.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll(".formatter-ref-cb");
            allChecked = !allChecked;
            checkboxes.forEach(cb => cb.checked = allChecked);
            toggleAll.textContent = allChecked ? "Uncheck All" : "Check All";
        });
    }
    
    let lastGeneratedText = "";
    
    generateBtn.addEventListener("click", async () => {
        const checkboxes = document.querySelectorAll(".formatter-ref-cb:checked");
        const refIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        const style = styleSelect.value;
        
        if (refIds.length === 0) {
            showToast("Please select at least one reference to compile.", "warning");
            return;
        }
        
        try {
            showToast("Formatting bibliography...");
            const formatted = await apiRequest("/api/citations/format", {
                method: "POST",
                body: { references_ids: refIds, style: style }
            });
            
            previewBox.innerHTML = "";
            let textCompile = [];
            
            formatted.forEach((item, idx) => {
                const p = document.createElement("div");
                p.style.marginBottom = "14px";
                // Render with inline HTML matching tags
                p.innerHTML = `<span style="color: var(--text-muted); font-size: 12px; margin-right: 6px;">[${idx+1}]</span> ${item.bibliography_html}`;
                previewBox.appendChild(p);
                textCompile.push(`${idx+1}. ${item.bibliography_text}`);
            });
            
            lastGeneratedText = textCompile.join("\n\n");
            showToast("Bibliography compiled successfully.");
            
        } catch(e) {}
    });
    
    copyBtn.addEventListener("click", () => {
        if (!lastGeneratedText) {
            showToast("Please compile the bibliography first.", "warning");
            return;
        }
        navigator.clipboard.writeText(lastGeneratedText);
        showToast("Bibliography text copied to clipboard.");
    });
    
    exportBtn.addEventListener("click", () => {
        if (!lastGeneratedText) {
            showToast("Compile bibliography first.", "warning");
            return;
        }
        const blob = new Blob([lastGeneratedText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bibliography.txt";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Bibliography downloaded.");
    });
});
