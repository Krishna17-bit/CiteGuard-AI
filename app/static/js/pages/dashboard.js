import { registerPage, state, apiRequest } from '../app.js';

registerPage('dashboard', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-plus" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p class="text-secondary" style="margin-top: 8px;">Please select or create a project in the sidebar to get started.</p>
            </div>
        `;
    }
    
    // Load data
    let references = [];
    let dupes = [];
    try {
        references = await apiRequest(`/api/references?project_id=${state.activeProjectId}`);
        // Quick find duplicates count
        const fd = new FormData();
        fd.append("project_id", state.activeProjectId);
        dupes = await apiRequest("/api/duplicates/find", { method: "POST", body: fd });
    } catch (e) {
        console.error("Dashboard failed to retrieve data:", e);
    }
    
    const total = references.length;
    const missingDoi = references.filter(r => !r.doi).length;
    const missingYear = references.filter(r => !r.year).length;
    const incomplete = references.filter(r => (r.metadata_quality_score || 100) < 70).length;
    const complete = total - incomplete;
    const dupesCount = dupes.length;
    
    // Calculate health score: start at 100
    // Deduct: -2 for missing DOI/Year, -10 for duplicates
    let healthScore = 100;
    if (total > 0) {
        const deductions = (missingDoi * 3) + (missingYear * 5) + (dupesCount * 8);
        healthScore = Math.max(0, 100 - deductions);
    }
    
    let healthClass = "badge-success";
    if (healthScore < 70) healthClass = "badge-danger";
    else if (healthScore < 90) healthClass = "badge-warning";
    
    // Populate simple style breakdown
    const typeCounts = {};
    references.forEach(r => {
        const st = r.source_type || "unknown";
        typeCounts[st] = (typeCounts[st] || 0) + 1;
    });
    
    const typeListHTML = Object.entries(typeCounts).map(([type, count]) => {
        const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span style="text-transform: capitalize;">${type}</span>
                    <span style="font-weight: 600;">${count} (${pct}%)</span>
                </div>
                <div style="height: 6px; background-color: var(--border-color); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background-color: var(--accent); border-radius: 3px;"></div>
                </div>
            </div>
        `;
    }).join("");
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
                <h2>Citation Dashboard</h2>
                <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Real-time health auditing and quality metrics for your project references.</p>
            </div>
            <span class="badge ${healthClass}" style="font-size: 14px; padding: 6px 14px;">
                <i class="fa-solid fa-heart-pulse"></i> Health Score: ${healthScore}%
            </span>
        </div>
        
        <!-- Metric Cards -->
        <div class="stats-grid">
            <div class="card stat-card">
                <span class="stat-label">Total References</span>
                <span class="stat-val" style="color: var(--text-primary);">${total}</span>
                <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-database"></i> Database Library</span>
            </div>
            <div class="card stat-card">
                <span class="stat-label">Healthy Records</span>
                <span class="stat-val" style="color: var(--success);">${complete}</span>
                <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-circle-check"></i> Quality Score &ge; 70%</span>
            </div>
            <span class="card stat-card" style="cursor: pointer;" onclick="location.hash='#repair'">
                <span class="stat-label">Missing DOI / Year</span>
                <span class="stat-val" style="color: var(--warning);">${missingDoi + missingYear}</span>
                <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-triangle-exclamation"></i> Requires repairing</span>
            </span>
            <span class="card stat-card" style="cursor: pointer;" onclick="location.hash='#duplicates'">
                <span class="stat-label">Duplicate Groups</span>
                <span class="stat-val" style="color: var(--danger);">${dupesCount}</span>
                <span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-clone"></i> Duplicate items found</span>
            </span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
            <!-- Left Side: Recent references checklist -->
            <div class="card">
                <div class="card-header">
                    <h4>Recent References</h4>
                    <button class="btn btn-secondary btn-sm" onclick="location.hash='#references'">View Library</button>
                </div>
                <div class="table-container">
                    ${references.length === 0 ? `
                        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                            <i class="fa-solid fa-receipt" style="font-size: 32px; margin-bottom: 8px;"></i>
                            <p>No references in this project library yet.</p>
                        </div>
                    ` : `
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Authors</th>
                                    <th>Year</th>
                                    <th>Quality</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${references.slice(0, 5).map(r => {
                                    const score = r.metadata_quality_score || 100;
                                    let badgeColor = "badge-success";
                                    if (score < 50) badgeColor = "badge-danger";
                                    else if (score < 80) badgeColor = "badge-warning";
                                    
                                    return `
                                        <tr>
                                            <td style="font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.title || "Untitled"}</td>
                                            <td style="color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.authors || "Unknown"}</td>
                                            <td>${r.year || "—"}</td>
                                            <td><span class="badge ${badgeColor}">${score}%</span></td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
            
            <!-- Right Side: Library Types breakdown -->
            <div class="card">
                <div class="card-header">
                    <h4>Source Type Breakdown</h4>
                </div>
                <div style="padding: 8px 0;">
                    ${total === 0 ? `
                        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                            <p>No statistics available yet.</p>
                        </div>
                    ` : typeListHTML}
                </div>
            </div>
        </div>
    `;
});
