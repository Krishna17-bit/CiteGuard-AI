import { registerPage, state, apiRequest, showToast, syncProjectsSelector } from '../app.js';

registerPage('projects', async () => {
    // Reload projects state
    try {
        state.projects = await apiRequest("/api/projects");
    } catch(e) {}
    
    return `
        <h2>Projects Manager</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Organize references and drafts under specific academic manuscripts, theses, or literature reviews.</p>
        
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: Existing Projects -->
            <div class="card">
                <div class="card-header">
                    <h4>Active Workspace Projects</h4>
                </div>
                <div class="table-container">
                    ${state.projects.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                            <i class="fa-solid fa-folder-closed" style="font-size: 36px; margin-bottom: 12px;"></i>
                            <p>No projects created yet.</p>
                        </div>
                    ` : `
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Created On</th>
                                    <th style="text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.projects.map(p => {
                                    const isActive = state.activeProjectId == p.id;
                                    const created = new Date(p.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    });
                                    return `
                                        <tr>
                                            <td style="font-weight: 600; color: ${isActive ? 'var(--accent)' : 'var(--text-primary)'};">
                                                ${p.name} ${isActive ? '<span class="badge badge-success" style="font-size: 9px; padding: 2px 6px; margin-left: 8px;">Active</span>' : ''}
                                            </td>
                                            <td style="color: var(--text-secondary);">${created}</td>
                                            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                                                ${!isActive ? `
                                                    <button class="btn btn-secondary btn-sm select-proj-btn" data-id="${p.id}">
                                                        Select
                                                    </button>
                                                ` : ''}
                                                <button class="btn btn-danger btn-sm delete-proj-btn" data-id="${p.id}">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
            
            <!-- Right Panel: Create New Project -->
            <div class="card" style="align-self: flex-start;">
                <div class="card-header">
                    <h4>Create New Project</h4>
                </div>
                <form id="create-project-form">
                    <div class="form-group">
                        <label for="project-name">Project Name <span class="required">*</span></label>
                        <input type="text" id="project-name" required class="form-input" placeholder="e.g. PhD Thesis Draft 3">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">
                        <i class="fa-solid fa-circle-plus"></i> Create & Select Project
                    </button>
                </form>
            </div>
        </div>
    `;
}, async () => {
    // Bind Event Listeners
    const form = document.getElementById("create-project-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("project-name").value.strip();
            if (!name) return;
            
            try {
                const res = await apiRequest("/api/projects", {
                    method: "POST",
                    body: { name }
                });
                showToast(`Project '${res.name}' created.`);
                state.activeProjectId = res.id;
                localStorage.setItem("citeguard_project_id", res.id);
                
                // Refresh list and dropdown selector
                await syncProjectsSelector();
                location.hash = "#dashboard";
            } catch (err) {}
        });
    }
    
    // Select project actions
    document.querySelectorAll(".select-proj-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const pId = e.currentTarget.getAttribute("data-id");
            state.activeProjectId = pId;
            localStorage.setItem("citeguard_project_id", pId);
            
            const select = document.getElementById("global-project-select");
            if (select) select.value = pId;
            
            showToast("Active project changed.");
            location.hash = "#dashboard";
        });
    });
    
    // Delete project actions
    document.querySelectorAll(".delete-proj-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const pId = e.currentTarget.getAttribute("data-id");
            if (!confirm("Are you sure you want to delete this project? This will permanently delete all references and metadata inside it!")) {
                return;
            }
            
            try {
                await apiRequest(`/api/projects/${pId}`, { method: "DELETE" });
                showToast("Project deleted.");
                
                if (state.activeProjectId == pId) {
                    state.activeProjectId = null;
                    localStorage.removeItem("citeguard_project_id");
                }
                
                await syncProjectsSelector();
                location.reload();
            } catch (err) {}
        });
    });
});
