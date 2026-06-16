import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('audit', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to run manuscript citation audits.</p>
            </div>
        `;
    }
    
    // Sample manuscript draft to seed the text box for user testing convenience
    const demoManuscriptText = `We investigate database schema refactoring techniques using Fowler's evolutionary methods [1]. Our neural architectures build upon standard multi-head self-attention mechanisms, particularly Transformers [3]. For advanced citation quality-control audits, we introduce the CiteGuard intelligence platform [5]. However, the GPT-4 technical report presents alternative parameters [6] that are currently unverified.`;
    
    return `
        <h2>Manuscript Citation Audit</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Paste manuscript draft sections to scan for inconsistent bracket formats, cited items missing from the bibliography, uncited records, and incorrect style sequences.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: Text input -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="card-header">
                    <h4>Manuscript Draft</h4>
                    <button class="btn btn-secondary btn-sm" id="audit-load-demo-btn">Load Demo Text</button>
                </div>
                
                <div class="form-group" style="flex: 1;">
                    <label for="audit-manuscript-text">Draft Manuscript Text</label>
                    <textarea id="audit-manuscript-text" class="form-input" style="flex: 1; min-height: 250px; font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6;" placeholder="Paste your draft chapter, literature review, or paper section here..."></textarea>
                </div>
                
                <div class="form-group">
                    <label>Target Citation Style Preset</label>
                    <select id="audit-style-select" class="form-input" style="padding: 8px;">
                        <option value="ieee">IEEE Numeric (e.g. [1])</option>
                        <option value="vancouver">Vancouver Numeric (e.g. [1])</option>
                        <option value="apa">APA Author-Date (e.g. (Smith, 2020))</option>
                        <option value="harvard">Harvard Author-Date</option>
                    </select>
                </div>
                
                <button class="btn btn-primary" id="run-audit-btn" style="width: 100%;">
                    <i class="fa-solid fa-file-shield"></i> Run Citation Audit
                </button>
            </div>
            
            <!-- Right Panel: Audit Report and Scores -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; min-height: 400px;">
                <div class="card-header">
                    <h4>Audit Analysis Report</h4>
                    <button class="btn btn-secondary btn-sm hidden" id="download-audit-report-btn"><i class="fa-solid fa-file-arrow-down"></i> Export Report</button>
                </div>
                
                <!-- Score Display -->
                <div id="audit-report-empty" style="text-align: center; padding: 60px 0; color: var(--text-muted); flex: 1;">
                    <i class="fa-solid fa-chart-bar" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Paste manuscript draft and click 'Run Citation Audit' to view health logs.</p>
                </div>
                
                <div id="audit-report-results" class="hidden" style="flex: 1; display: flex; flex-direction: column; gap: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; background-color: var(--bg-sidebar); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Citation Health Score</span>
                            <h3 style="font-size: 32px; font-weight: 800; margin-top: 4px;" id="audit-score-val">100%</h3>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge" id="audit-badge-status" style="font-size: 12px; padding: 6px 12px;">No Issues</span>
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px;" id="audit-summary-counts"></p>
                        </div>
                    </div>
                    
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
                        <h5>Detailed Audit Warnings Checklist</h5>
                        <div style="overflow-y: auto; max-height: 250px; display: flex; flex-direction: column; gap: 10px;" id="audit-issues-container">
                            <!-- Dynamic issues go here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}, async () => {
    const demoBtn = document.getElementById("audit-load-demo-btn");
    const runBtn = document.getElementById("run-audit-btn");
    const textBox = document.getElementById("audit-manuscript-text");
    const styleSelect = document.getElementById("audit-style-select");
    const emptyBox = document.getElementById("audit-report-empty");
    const resultsBox = document.getElementById("audit-report-results");
    const scoreVal = document.getElementById("audit-score-val");
    const badgeStatus = document.getElementById("audit-badge-status");
    const summaryCounts = document.getElementById("audit-summary-counts");
    const issuesContainer = document.getElementById("audit-issues-container");
    const downloadReportBtn = document.getElementById("download-audit-report-btn");
    
    if (!runBtn) return;
    
    // Load pre-seeded text
    const demoManuscriptText = `We investigate database schema refactoring techniques using Fowler's evolutionary methods [1]. Our neural architectures build upon standard multi-head self-attention mechanisms, particularly Transformers [3]. For advanced citation quality-control audits, we introduce the CiteGuard intelligence platform [5]. However, the GPT-4 technical report presents alternative parameters [6] that are unverified.`;
    
    demoBtn.addEventListener("click", () => {
        textBox.value = demoManuscriptText;
        showToast("Demo manuscript text loaded.");
    });
    
    let lastReportText = "";
    
    runBtn.addEventListener("click", async () => {
        const text = textBox.value.trim();
        const style = styleSelect.value;
        
        if (!text) {
            showToast("Please enter or paste manuscript text to audit.", "warning");
            return;
        }
        
        try {
            showToast("Scanning manuscript citations...");
            const fd = new FormData();
            fd.append("project_id", state.activeProjectId);
            fd.append("manuscript", text);
            fd.append("style", style);
            
            const res = await apiRequest("/api/audit/manuscript", {
                method: "POST",
                body: fd
            });
            
            emptyBox.classList.add("hidden");
            resultsBox.classList.remove("hidden");
            downloadReportBtn.classList.remove("hidden");
            
            // Set Score
            const score = res.health_score;
            scoreVal.textContent = `${score}%`;
            
            if (score >= 90) {
                scoreVal.style.color = "var(--success)";
                badgeStatus.className = "badge badge-success";
                badgeStatus.innerHTML = '<i class="fa-solid fa-shield"></i> Exceptional';
            } else if (score >= 70) {
                scoreVal.style.color = "var(--warning)";
                badgeStatus.className = "badge badge-warning";
                badgeStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Warning';
            } else {
                scoreVal.style.color = "var(--danger)";
                badgeStatus.className = "badge badge-danger";
                badgeStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Critical Issues';
            }
            
            summaryCounts.textContent = `Scanned ${res.citations_found.length} citations, found ${res.issues.length} warnings`;
            
            // Render detailed issues checklist
            issuesContainer.innerHTML = "";
            let reportLines = [`CITEGUARD AI CITATION AUDIT REPORT`, `Health Score: ${score}%`, `Total Warnings: ${res.issues.length}`, `===================================\n`];
            
            if (res.issues.length === 0) {
                issuesContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--success);">
                        <i class="fa-solid fa-shield-check" style="font-size: 24px; margin-bottom: 8px;"></i>
                        <p>No citation errors or omissions detected. Ready for publication!</p>
                    </div>
                `;
                reportLines.push("All clean! No issues detected.");
            } else {
                res.issues.forEach((issue, index) => {
                    let sevClass = "badge-success";
                    if (issue.severity === "critical") sevClass = "badge-danger";
                    else if (issue.severity === "high") sevClass = "badge-danger";
                    else if (issue.severity === "medium") sevClass = "badge-warning";
                    else if (issue.severity === "low") sevClass = "badge-info";
                    
                    const issueDiv = document.createElement("div");
                    issueDiv.style.backgroundColor = "var(--bg-main)";
                    issueDiv.style.padding = "12px";
                    issueDiv.style.borderRadius = "8px";
                    issueDiv.style.border = "1px solid var(--border-color)";
                    issueDiv.style.fontSize = "13px";
                    
                    issueDiv.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <strong style="text-transform: capitalize; color: var(--text-primary);"><i class="fa-solid fa-bug" style="color: var(--danger);"></i> ${issue.issue_type.replace("_", " ")}</strong>
                            <span class="badge ${sevClass}" style="font-size: 9px; padding: 2px 6px;">${issue.severity}</span>
                        </div>
                        <p style="color: var(--text-secondary); margin-bottom: 6px;">${issue.message}</p>
                        <div style="font-size: 11.5px; color: var(--text-muted);">
                            <strong>Location:</strong> ${issue.location}<br>
                            <strong>Suggested Fix:</strong> <span style="color: var(--accent);">${issue.suggested_fix}</span>
                        </div>
                    `;
                    issuesContainer.appendChild(issueDiv);
                    
                    reportLines.push(`Warning #${index+1} [${issue.severity.toUpperCase()}]: ${issue.issue_type}`);
                    reportLines.push(`Message: ${issue.message}`);
                    reportLines.push(`Location: ${issue.location}`);
                    reportLines.push(`Suggested Fix: ${issue.suggested_fix}`);
                    reportLines.push(`-----------------------------------\n`);
                });
            }
            
            lastReportText = reportLines.join("\n");
            showToast("Manuscript audited.");
            
        } catch(e) {}
    });
    
    downloadReportBtn.addEventListener("click", () => {
        if (!lastReportText) return;
        const blob = new Blob([lastReportText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "citation_audit_report.txt";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Audit report exported.");
    });
});
