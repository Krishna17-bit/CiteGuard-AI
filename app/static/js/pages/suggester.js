import { registerPage, state, apiRequest, showToast } from '../app.js';

registerPage('suggester', async () => {
    if (!state.activeProjectId) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fa-solid fa-folder-closed" style="font-size: 48px; color: var(--accent); margin-bottom: 16px;"></i>
                <h3>No Active Project</h3>
                <p>Please select a project to get citation suggestions.</p>
            </div>
        `;
    }
    
    return `
        <h2>Citation Suggestion Tool</h2>
        <p class="text-secondary" style="font-size: 14px; margin-top: 4px;">Paste uncited text paragraphs. CiteGuard scans the wording of each claim, searches your project library resources, and suggests citation insertions.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; margin-top: 16px;">
            <!-- Left Pane: Input text -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; align-self: flex-start;">
                <div class="card-header">
                    <h4>Draft Literature Review</h4>
                    <button class="btn btn-secondary btn-sm" id="suggester-demo-btn">Load Uncited Demo</button>
                </div>
                
                <div class="form-group">
                    <label for="suggester-text">Enter Manuscript Section</label>
                    <textarea id="suggester-text" class="form-input" rows="8" style="font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6;" placeholder="Paste uncited sentences or paragraphs..."></textarea>
                </div>
                
                <button class="btn btn-primary" id="run-suggester-btn" style="width: 100%;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Scan for Citation Suggestions
                </button>
            </div>
            
            <!-- Right Pane: Suggestion card items -->
            <div class="card" style="display: flex; flex-direction: column; gap: 16px; min-height: 400px;">
                <div class="card-header">
                    <h4>Citation Placement Suggestions</h4>
                </div>
                
                <div id="suggester-empty" style="text-align: center; padding: 60px 0; color: var(--text-muted); flex: 1;">
                    <i class="fa-solid fa-brain" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Paste uncited review text and run scanner to inspect bibliography suggestions.</p>
                </div>
                
                <div id="suggester-results" class="hidden" style="flex: 1; display: flex; flex-direction: column; gap: 14px;">
                    <!-- Dynamic suggestion cards -->
                </div>
            </div>
        </div>
    `;
}, async () => {
    const demoBtn = document.getElementById("suggester-demo-btn");
    const runBtn = document.getElementById("run-suggester-btn");
    const textBox = document.getElementById("suggester-text");
    const emptyBox = document.getElementById("suggester-empty");
    const resultsBox = document.getElementById("suggester-results");
    
    if (!runBtn) return;
    
    const demoSuggesterText = `Database schema refactoring techniques help software teams adapt relational schemas evolutionary alongside code changes. Neural architectures utilize multi-head self-attention mechanisms to learn global contextual mappings. Advanced citation quality-control auditing helps researchers verify claims and metadata.`;
    
    demoBtn.addEventListener("click", () => {
        textBox.value = demoSuggesterText;
        showToast("Uncited review draft loaded.");
    });
    
    runBtn.addEventListener("click", async () => {
        const text = textBox.value.strip();
        if (!text) {
            showToast("Enter some manuscript text to verify.", "warning");
            return;
        }
        
        try {
            showToast("Analyzing claim semantics...");
            // Call verifier endpoint which automatically recommends sources for uncited claims
            const res = await apiRequest("/api/claims/verify", {
                method: "POST",
                body: { project_id: parseInt(state.activeProjectId), text: text }
            });
            
            emptyBox.classList.add("hidden");
            resultsBox.classList.remove("hidden");
            resultsBox.innerHTML = "";
            
            let foundSuggestion = false;
            
            res.results.forEach((item, index) => {
                // If it needs citation and has a suggested source
                if (item.suggested_reference_id) {
                    foundSuggestion = true;
                    
                    const card = document.createElement("div");
                    card.style.backgroundColor = "var(--bg-main)";
                    card.style.padding = "16px";
                    card.style.borderRadius = "8px";
                    card.style.border = "1px solid var(--border-color)";
                    card.style.fontSize = "13px";
                    
                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="color: var(--accent);"><i class="fa-solid fa-lightbulb"></i> Sentence #${index+1}</strong>
                            <span class="badge badge-info" style="font-size: 9px; padding: 2px 6px;">Match Score: ${(item.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p style="color: var(--text-primary); margin-bottom: 8px; font-style: italic;">"${item.claim}"</p>
                        <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 8px;">
                            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Suggested Reference Source</span>
                            <div style="font-weight: 600; color: var(--text-primary); margin: 4px 0;">
                                ${item.suggested_source}
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; background-color: var(--bg-sidebar); padding: 8px; border-radius: 4px; border-left: 2px solid var(--accent);">
                                ${item.explanation}
                            </p>
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
                            <button class="btn btn-secondary btn-sm copy-cite-marker-btn" data-title="${item.suggested_source}">
                                Copy Citation Tag
                            </button>
                        </div>
                    `;
                    resultsBox.appendChild(card);
                }
            });
            
            if (!foundSuggestion) {
                resultsBox.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fa-solid fa-circle-check" style="font-size: 32px; color: var(--success); margin-bottom: 12px; display: block;"></i>
                        All clean! No matching reference suggestions found for these claims in your library.
                    </div>
                `;
            } else {
                // Bind Copy citation tag button
                document.querySelectorAll(".copy-cite-marker-btn").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        const title = e.currentTarget.getAttribute("data-title");
                        // Guess simple citation key like Smith2017
                        const tag = `[Cite: ${title}]`;
                        navigator.clipboard.writeText(tag);
                        showToast(`Citation marker tag '${tag}' copied to clipboard.`);
                    });
                });
            }
            
            showToast("Suggestions compiled.");
            
        } catch(e) {}
    });
});
