import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('settings', async () => {
    let providers = {};
    try {
        providers = await apiRequest("/api/settings/providers");
        state.providers = providers;
    } catch(e) {}
    
    const providerCardsHTML = Object.entries(providers).map(([name, data]) => {
        const isActive = data.active;
        const badgeClass = isActive ? "badge-success" : "badge-danger";
        const badgeLabel = isActive ? "Configured" : "Not Configured";
        const btnLabel = isActive ? "Test Connection" : "Test Key";
        
        return `
            <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="text-transform: capitalize; color: var(--text-primary); font-size: 15px;">${name} API</h5>
                        <span class="badge ${badgeClass}" style="font-size: 9px; padding: 2px 6px;">${badgeLabel}</span>
                    </div>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">
                        Model default: <span style="font-family: monospace; color: var(--accent);">${data.model || 'none'}</span>
                    </p>
                </div>
                
                <button class="btn btn-secondary btn-sm test-provider-btn" data-provider="${name}" style="width: 100%;">
                    <i class="fa-solid fa-signal"></i> ${btnLabel}
                </button>
            </div>
        `;
    }).join("");
    
    return `
        <h2>System Settings & APIs</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Manage LLM settings, test API connections, and check environment workspace paths.</p>
        
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-top: 16px;">
            <!-- Left Panel: Providers grid -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="card-header">
                    <h4>AI Language Providers</h4>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    ${providerCardsHTML}
                </div>
                
                <div style="margin-top: 16px; background-color: var(--danger-glow); border: 1px solid hsla(355, 85%, 55%, 0.3); padding: 16px; border-radius: 8px;">
                    <h5 style="color: var(--danger);"><i class="fa-solid fa-user-lock"></i> Privacy and Security Notice</h5>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 6px;">
                        When running in non-Mock mode, verifying claims or extracting PDF data uploads snippets of your drafts to the selected cloud LLM providers (Gemini, OpenAI, Anthropic, Groq, or Mistral).
                    </p>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 4px;">
                        Ensure you comply with institutional guidelines before sending unpublished academic drafts to external servers. To run completely local and private, choose the **Ollama** provider.
                    </p>
                </div>
            </div>
            
            <!-- Right Panel: Environment details -->
            <div class="card" style="align-self: flex-start; display: flex; flex-direction: column; gap: 16px;">
                <div class="card-header">
                    <h4>Workspace Context</h4>
                </div>
                
                <div style="font-size: 13px; display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <span style="font-weight: 700; color: var(--text-muted); font-size: 11px; text-transform: uppercase;">SQLite Local Database</span>
                        <p style="font-family: monospace; background-color: var(--bg-main); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 4px;">
                            citeguard.db
                        </p>
                    </div>
                    
                    <div>
                        <span style="font-weight: 700; color: var(--text-muted); font-size: 11px; text-transform: uppercase;">File Uploads Directory</span>
                        <p style="font-family: monospace; background-color: var(--bg-main); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 4px;">
                            uploads/
                        </p>
                    </div>
                    
                    <div>
                        <span style="font-weight: 700; color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Temp Exports Folder</span>
                        <p style="font-family: monospace; background-color: var(--bg-main); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 4px;">
                            exports/
                        </p>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 12px; font-size: 12px; color: var(--text-secondary);">
                        To update variables (such as API keys), modify the local <span style="font-family: monospace; color: var(--accent);">.env</span> configuration file and restart the FastAPI python server.
                    </div>
                </div>
            </div>
        </div>
    `;
}, async () => {
    // Bind Test connection buttons
    document.querySelectorAll(".test-provider-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const provider = e.currentTarget.getAttribute("data-provider");
            try {
                showToast(`Testing ${provider} client...`);
                const fd = new FormData();
                fd.append("provider", provider);
                
                const res = await apiRequest("/api/settings/providers/test", {
                    method: "POST",
                    body: fd
                });
                
                if (res.status === "success") {
                    showToast(res.message);
                } else {
                    showToast(res.message, "error");
                }
            } catch(err) {
                // Toasts handled globally
            }
        });
    });
});
