// Global SPA State Store and Router

export const state = {
    activeProjectId: null,
    projects: [],
    references: [],
    currentHash: "dashboard",
    providers: {}
};

// Central API fetch helper
export async function apiRequest(endpoint, options = {}) {
    const defaultHeaders = {};
    
    // Auto-detect Body content type
    if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
        if (typeof options.body === "object") {
            options.body = JSON.stringify(options.body);
        }
    }
    
    const fetchOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(endpoint, fetchOptions);
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP error ${response.status}`);
        }
        
        // Return file blob if header matches file attachments
        const contentType = response.headers.get("content-type");
        if (contentType && (contentType.includes("application/octet-stream") || contentType.includes("text/plain") || contentType.includes("text/xml"))) {
            return await response.blob();
        }
        
        return await response.json();
    } catch (error) {
        showToast(error.message, "error");
        throw error;
    }
}

// Global Toast Alerts
export function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconClass = "fa-circle-check";
    if (type === "warning") iconClass = "fa-triangle-exclamation";
    if (type === "error") iconClass = "fa-circle-xmark";
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove toast after 4s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Global Page Modules Map
const pageModules = {};

export function registerPage(name, renderFunc, bindEventsFunc = () => {}) {
    pageModules[name] = { render: renderFunc, bindEvents: bindEventsFunc };
}

// Load dynamic page
async function loadPage(pageName) {
    const contentArea = document.getElementById("page-content");
    if (!contentArea) return;
    
    // Set loading spinner
    contentArea.innerHTML = `
        <div class="page-loading">
            <div class="spinner"></div>
            <p>Gathering citation insights...</p>
        </div>
    `;
    
    // Import and register component dynamically if not loaded
    if (!pageModules[pageName]) {
        try {
            await import(`./pages/${pageName}.js`);
        } catch (error) {
            console.error(`Failed to load page module ${pageName}:`, error);
            contentArea.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fa-solid fa-circle-exclamation text-danger" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h3>Page Not Found</h3>
                    <p class="text-secondary" style="margin-top: 8px;">The component '${pageName}' is missing or failed to compile.</p>
                </div>
            `;
            return;
        }
    }
    
    const module = pageModules[pageName];
    if (module) {
        try {
            // Render template
            contentArea.innerHTML = await module.render();
            // Bind listeners
            await module.bindEvents();
        } catch (error) {
            console.error(`Error rendering page ${pageName}:`, error);
            contentArea.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fa-solid fa-bug" style="font-size: 48px; color: var(--danger); margin-bottom: 16px;"></i>
                    <h3>Application Error</h3>
                    <p style="margin-top: 8px; color: var(--text-secondary);">${error.message}</p>
                </div>
            `;
        }
    }
}

// Load and Sync Projects selector
export async function syncProjectsSelector() {
    const select = document.getElementById("global-project-select");
    if (!select) return;
    
    try {
        state.projects = await apiRequest("/api/projects");
        select.innerHTML = "";
        
        if (state.projects.length === 0) {
            select.innerHTML = `<option value="">No Projects Available</option>`;
            return;
        }
        
        state.projects.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            if (state.activeProjectId && p.id == state.activeProjectId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        
        // Pick first project if not selected
        if (!state.activeProjectId && state.projects.length > 0) {
            state.activeProjectId = state.projects[0].id;
            localStorage.setItem("citeguard_project_id", state.activeProjectId);
            select.value = state.activeProjectId;
        }
    } catch (e) {
        console.error("Failed to load projects list:", e);
    }
}

// Router Initializations
function handleHashChange() {
    const rawHash = location.hash.replace("#", "");
    const page = rawHash ? rawHash.split("?")[0] : "dashboard";
    
    // Set active link style
    document.querySelectorAll(".nav-link").forEach(link => {
        if (link.getAttribute("data-page") === page) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
    
    state.currentHash = page;
    loadPage(page);
}

// Global Manual Add Modal actions
function setupGlobalModal() {
    const modal = document.getElementById("global-modal");
    const openBtn = document.getElementById("quick-add-btn");
    const closeBtn = document.getElementById("modal-close");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const form = document.getElementById("quick-add-form");
    
    if (!modal) return;
    
    const openModal = () => modal.classList.remove("hidden");
    const closeModal = () => {
        modal.classList.add("hidden");
        form.reset();
    };
    
    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!state.activeProjectId) {
            showToast("Please select or create a project first.", "warning");
            return;
        }
        
        const payload = {
            project_id: parseInt(state.activeProjectId),
            title: document.getElementById("m-title").value,
            source_type: document.getElementById("m-type").value,
            authors: document.getElementById("m-authors").value,
            year: parseInt(document.getElementById("m-year").value) || null,
            doi: document.getElementById("m-doi").value,
            arxiv_id: document.getElementById("m-arxiv").value,
            container_title: document.getElementById("m-venue").value,
            publisher: document.getElementById("m-publisher").value,
            volume: document.getElementById("m-volume").value,
            issue: document.getElementById("m-issue").value,
            pages: document.getElementById("m-pages").value,
            abstract: document.getElementById("m-abstract").value
        };
        
        try {
            await apiRequest("/api/references", {
                method: "POST",
                body: payload
            });
            showToast("Reference saved successfully.");
            closeModal();
            // Reload active page to show new reference
            handleHashChange();
        } catch (e) {
            // Toast automatically handled by apiRequest
        }
    });
}

// App Launch Setup
window.addEventListener("DOMContentLoaded", async () => {
    // Restore project from cache
    state.activeProjectId = localStorage.getItem("citeguard_project_id");
    
    await syncProjectsSelector();
    
    const select = document.getElementById("global-project-select");
    if (select) {
        select.addEventListener("change", (e) => {
            state.activeProjectId = e.target.value;
            localStorage.setItem("citeguard_project_id", state.activeProjectId);
            showToast("Active project updated.");
            // Reload active page
            handleHashChange();
        });
    }
    
    setupGlobalModal();
    
    // Hash router listeners
    window.addEventListener("hashchange", handleHashChange);
    // Boot hash route
    handleHashChange();
});
