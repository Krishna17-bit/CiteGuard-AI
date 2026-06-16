import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('checker', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to verify journal compliance.</p>
            </div>
        `;
    }
    
    return `
        <h2>Journal Submission Checker</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Verify if your library reference lists satisfy publishing constraints. Checks for missing DOIs, website access dates, and volume fields.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; margin-top: 16px;">
            <!-- Left panel: Style Selector -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; align-self: flex-start;">
                <div class="card-header">
                    <h4>Configure Target Style</h4>
                </div>
                
                <form id="journal-checker-form">
                    <div class="form-group">
                        <label>Target Publication Style</label>
                        <select id="checker-style-select" class="form-input" style="padding: 8px;">
                            <option value="ieee">IEEE style (Mandates DOIs)</option>
                            <option value="nature">Nature style (Mandates DOIs & short authors lists)</option>
                            <option value="apa">APA 7th style</option>
                            <option value="vancouver">Vancouver medical style</option>
                        </select>
                    </div>
                </form>
                
                <button type="submit" form="journal-checker-form" class="btn btn-primary" style="width: 100%;">
                    <i class="fa-solid fa-clipboard-check"></i> Run Compliance Check
                </button>
            </div>
            
            <!-- Right Panel: Report Details -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; min-height: 400px;">
                <div class="card-header">
                    <h4>Compliance Audit Log</h4>
                </div>
                
                <div id="checker-empty-box" style="text-align: center; padding: 60px 0; color: var(--text-muted);">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Select target style and scan to audit submission readiness.</p>
                </div>
                
                <div id="checker-report-box" class="hidden" style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- Status Header card -->
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-radius: 8px;" id="checker-status-card">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Submission Status</span>
                            <h4 id="checker-status-title" style="margin-top: 4px; font-weight: 700;">Compliant</h4>
                        </div>
                        <div id="checker-status-icon" style="font-size: 28px;"></div>
                    </div>
                    
                    <!-- Details table -->
                    <div class="table-container">
                        <table class="custom-table" style="font-size: 13px;">
                            <thead>
                                <tr>
                                    <th>Reference</th>
                                    <th>Rule Failed</th>
                                    <th>Warning Details</th>
                                </tr>
                            </thead>
                            <tbody id="checker-tbody">
                                <!-- Warning row elements -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}, async () => {
    const form = document.getElementById("journal-checker-form");
    const emptyBox = document.getElementById("checker-empty-box");
    const reportBox = document.getElementById("checker-report-box");
    const statusCard = document.getElementById("checker-status-card");
    const statusTitle = document.getElementById("checker-status-title");
    const statusIcon = document.getElementById("checker-status-icon");
    const tbody = document.getElementById("checker-tbody");
    
    if (!form) return;
    
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const style = document.getElementById("checker-style-select").value;
        
        try {
            showToast("Verifying submission compliance rules...");
            const fd = new FormData();
            fd.append("project_id", state.activeProjectId);
            fd.append("style", style);
            
            const res = await apiRequest("/api/journal-check", {
                method: "POST",
                body: fd
            });
            
            emptyBox.classList.add("hidden");
            reportBox.classList.remove("hidden");
            tbody.innerHTML = "";
            
            if (res.compliant) {
                statusCard.style.backgroundColor = "var(--success-glow)";
                statusCard.style.border = "1px solid hsla(145, 80%, 42%, 0.3)";
                statusTitle.textContent = "Compliant";
                statusTitle.style.color = "var(--success)";
                statusIcon.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--success);"></i>`;
                
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; color: var(--success); padding: 24px;">
                            <i class="fa-solid fa-shield-check" style="font-size: 24px; margin-bottom: 8px;"></i>
                            <p>Compliance checks passed! Ready for publication submit.</p>
                        </td>
                    </tr>
                `;
            } else {
                statusCard.style.backgroundColor = "var(--warning-glow)";
                statusCard.style.border = "1px solid hsla(38, 92%, 50%, 0.3)";
                statusTitle.textContent = "Non-Compliant Checklist Warnings";
                statusTitle.style.color = "var(--warning)";
                statusIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i>`;
                
                res.issues.forEach(issue => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td style="font-weight: 600; max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${issue.title}</td>
                        <td><span class="badge badge-warning">${issue.rule}</span></td>
                        <td style="color: var(--text-secondary); line-height: 1.4;">
                            ${issue.message}<br>
                            <span style="font-size: 11.5px; color: var(--accent);">Fix: ${issue.suggested_fix}</span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            
            showToast("Compliance scan complete.");
            
        } catch(err) {}
    });
});
