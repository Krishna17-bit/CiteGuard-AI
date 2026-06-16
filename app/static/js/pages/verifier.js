import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('verifier', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project Selected</h3>
                <p>Please select a project to verify citations.</p>
            </div>
        `;
    }
    
    return `
        <h2>Claim-to-Citation Verifier</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Paste manuscript draft paragraphs. CiteGuard splits sentences into factual claims, inspects cited reference text layers, and flags weak support or citation mismatches.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.8fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: Claim Input -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; align-self: flex-start;">
                <div class="card-header">
                    <h4>Manuscript Claims Section</h4>
                    <button class="btn btn-secondary btn-sm" id="verify-load-demo-btn">Load Claim Demo</button>
                </div>
                
                <div class="form-group">
                    <label for="verify-claims-text">Enter Paragraph Section</label>
                    <textarea id="verify-claims-text" class="form-input" rows="8" style="font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6;" placeholder="Paste paragraph draft containing bracketed references (e.g. [1] or [3])..."></textarea>
                </div>
                
                <button class="btn btn-primary" id="run-verify-btn" style="width: 100%;">
                    <i class="fa-solid fa-circle-check"></i> Verify Citation Claims
                </button>
            </div>
            
            <!-- Right Panel: Verification Output -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; min-height: 400px;">
                <div class="card-header">
                    <h4>Fact-Checking Audit Checklist</h4>
                </div>
                
                <div id="verify-report-empty" style="text-align: center; padding: 60px 0; color: var(--text-muted); flex: 1;">
                    <i class="fa-solid fa-user-shield" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Paste draft section and click 'Verify Citation Claims' to inspect support evidence.</p>
                </div>
                
                <div id="verify-report-results" class="hidden" style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
                    <div class="table-container">
                        <table class="custom-table" style="font-size: 13px;">
                            <thead>
                                <tr>
                                    <th>Claim Sentence</th>
                                    <th>Cited Source</th>
                                    <th>Support Status</th>
                                    <th>Confidence</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="verify-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Explanation Info Dialog (Hidden initially) -->
        <div id="verify-details-card" class="card hidden">
            <div class="card-header">
                <h4>Citation Support Details</h4>
                <button class="btn btn-secondary btn-sm" id="close-details-btn">Dismiss</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; padding: 8px 0;" id="verify-details-body"></div>
        </div>
    `;
}, async () => {
    const demoBtn = document.getElementById("verify-load-demo-btn");
    const runBtn = document.getElementById("run-verify-btn");
    const textBox = document.getElementById("verify-claims-text");
    const emptyBox = document.getElementById("verify-report-empty");
    const resultsBox = document.getElementById("verify-report-results");
    const tbody = document.getElementById("verify-tbody");
    
    const detailsCard = document.getElementById("verify-details-card");
    const detailsBody = document.getElementById("verify-details-body");
    const closeDetailsBtn = document.getElementById("close-details-btn");
    
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener("click", () => detailsCard.classList.add("hidden"));
    }
    
    if (!runBtn) return;
    
    const demoVerifyText = `Database schema refactoring techniques help engineering teams evolve codebase architecture and database schemas iteratively [1]. Our neural network architectures build upon standard multi-head self-attention mechanisms, particularly Transformers [3]. We also discover that relational databases are 1000x faster than NoSQL database engines for all scale sizes [1].`;
    
    demoBtn.addEventListener("click", () => {
        textBox.value = demoVerifyText;
        showToast("Claim verification demo loaded.");
    });
    
    runBtn.addEventListener("click", async () => {
        const text = textBox.value.strip();
        if (!text) {
            showToast("Please enter manuscript paragraph to verify.", "warning");
            return;
        }
        
        try {
            showToast("Verifying cited claims...");
            const res = await apiRequest("/api/claims/verify", {
                method: "POST",
                body: { project_id: parseInt(state.activeProjectId), text: text }
            });
            
            emptyBox.classList.add("hidden");
            resultsBox.classList.remove("hidden");
            tbody.innerHTML = "";
            
            res.results.forEach((item, index) => {
                let statusBadge = "";
                let confColor = "var(--text-primary)";
                
                if (item.status === "Supported") {
                    statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Supported</span>`;
                    confColor = "var(--success)";
                } else if (item.status === "Partially Supported") {
                    statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> Partial</span>`;
                    confColor = "var(--warning)";
                } else if (item.status === "Needs Citation") {
                    statusBadge = `<span class="badge badge-info"><i class="fa-solid fa-wand-magic-sparkles"></i> Needs Citation</span>`;
                    confColor = "var(--info)";
                } else {
                    statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Mismatch / Weak</span>`;
                    confColor = "var(--danger)";
                }
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.claim}</td>
                    <td style="color: var(--text-secondary); max-width: 120px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.suggested_source || 'None'}</td>
                    <td>${statusBadge}</td>
                    <td style="font-weight: 700; color: ${confColor};">${(item.confidence * 100).toFixed(0)}%</td>
                    <td>
                        <button class="btn btn-secondary btn-sm inspect-claim-btn" data-idx="${index}">
                            Inspect
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // Bind Inspect buttons
            document.querySelectorAll(".inspect-claim-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
                    const item = res.results[idx];
                    
                    let intentBadge = "";
                    const intent = item.citation_intent || "Background";
                    if (intent === "Critique") {
                        intentBadge = `<span class="badge badge-danger"><i class="fa-solid fa-triangle-exclamation"></i> Critique</span>`;
                    } else if (intent === "Methodology") {
                        intentBadge = `<span class="badge badge-warning"><i class="fa-solid fa-gears"></i> Methodology</span>`;
                    } else if (intent === "Results Support") {
                        intentBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Results Support</span>`;
                    } else {
                        intentBadge = `<span class="badge badge-info"><i class="fa-solid fa-circle-info"></i> Background</span>`;
                    }
                    
                    detailsCard.classList.remove("hidden");
                    detailsBody.innerHTML = `
                        <div>
                            <strong>Audited Claim Sentence:</strong>
                            <p style="color: var(--text-primary); font-size: 14px; margin-top: 4px; background-color: var(--bg-main); padding: 10px; border-radius: 6px;">"${item.claim}"</p>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px;">
                            <div>
                                <strong>Match Status:</strong><br>
                                <span style="margin-top: 4px; display: inline-block;">${item.status === 'Supported' ? '<span class="badge badge-success">Supported</span>' : item.status === 'Partially Supported' ? '<span class="badge badge-warning">Partially Supported</span>' : '<span class="badge badge-danger">' + item.status + '</span>'}</span>
                            </div>
                            <div>
                                <strong>Confidence Score:</strong><br>
                                <strong style="font-size: 16px; color: var(--accent); margin-top: 4px; display: inline-block;">${(item.confidence * 100).toFixed(0)}%</strong>
                            </div>
                            <div>
                                <strong>Evidence Source:</strong><br>
                                <span style="margin-top: 4px; display: inline-block;" class="badge badge-secondary">
                                    <i class="fa-solid fa-file-pdf"></i> ${item.page_number ? 'Page ' + item.page_number : 'Abstract / Library'}
                                </span>
                            </div>
                            <div>
                                <strong>Citation Intent:</strong><br>
                                <span style="margin-top: 4px; display: inline-block;">${intentBadge}</span>
                            </div>
                        </div>
                        <div>
                            <strong>Scholarly Evidence quote (from Abstract/PDF):</strong>
                            <p style="color: var(--success); font-style: italic; font-size: 13.5px; margin-top: 4px; background-color: var(--bg-main); padding: 10px; border-radius: 6px; border-left: 3px solid var(--success);">
                                ${item.evidence ? `"${item.evidence}"` : '<span style="color: var(--text-muted);">No supporting quotes found in referenced bibliography resources.</span>'}
                            </p>
                        </div>
                        <div>
                            <strong>Audit Explanation:</strong>
                            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${item.explanation}</p>
                        </div>
                    `;
                    detailsCard.scrollIntoView({ behavior: 'smooth' });
                });
            });
            
            showToast("Paragraph claims verified.");
            
        } catch(e) {}
    });
});
