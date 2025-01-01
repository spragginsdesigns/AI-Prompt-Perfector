// Utility Functions
function showNotification(message, type = "success") {
	const notification = document.getElementById("notification");
	notification.textContent = "";

	const icon = document.createElement("i");
	icon.className = `fas fa-${
		type === "success" ? "check-circle" : "exclamation-circle"
	} mr-3`;

	const text = document.createElement("span");
	text.textContent = message;

	notification.appendChild(icon);
	notification.appendChild(text);

	notification.className = `notification-slide fixed bottom-4 right-4 max-w-md p-4 rounded-lg shadow-lg z-50 ${
		type === "success" ? "bg-green-500" : "bg-red-500"
	} text-white flex items-center`;

	setTimeout(() => {
		notification.className = notification.className.replace(
			"notification-slide",
			"translate-y-20 opacity-0"
		);
	}, 3000);
}

// Prompt Management
class PromptLibrary {
	constructor() {
		if (!window.config) {
			console.error("Configuration not loaded");
			showNotification("Configuration error", "error");
			return;
		}

		this.supabase = supabase.createClient(
			window.config.supabaseUrl,
			window.config.supabaseKey
		);

		if (!this.supabase) {
			console.error("Supabase client not initialized");
			showNotification("Database connection error", "error");
			return;
		}
		this.initializeEventListeners();
		this.loadPrompts();
	}

	async loadPrompts() {
		try {
			const { data, error } = await this.supabase
				.from("prompts")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) throw error;

			this.prompts = data || [];
			this.renderPromptGrid();
		} catch (error) {
			console.error("Error loading prompts:", error);
			showNotification("Failed to load prompts", "error");
			this.prompts = [];
		}
	}

	async savePrompt(prompt) {
		try {
			const { data, error } = await this.supabase
				.from("prompts")
				.insert([
					{
						title: prompt.title,
						description: prompt.description,
						content: prompt.content,
						tags: prompt.tags,
						format: prompt.format,
						author: prompt.author
					}
				])
				.select();

			if (error) throw error;

			this.prompts.unshift(data[0]);
			this.renderPromptGrid();
			return data[0];
		} catch (error) {
			console.error("Error saving prompt:", error);
			throw error;
		}
	}

	async deletePrompt(id) {
		try {
			const { error } = await this.supabase
				.from("prompts")
				.delete()
				.eq("id", id);

			if (error) throw error;

			this.prompts = this.prompts.filter((p) => p.id !== id);
			this.renderPromptGrid();
			showNotification("Prompt deleted successfully", "success");
		} catch (error) {
			console.error("Error deleting prompt:", error);
			showNotification("Failed to delete prompt", "error");
		}
	}

	async updatePrompt(id, updates) {
		try {
			const { data, error } = await this.supabase
				.from("prompts")
				.update({
					title: updates.title,
					description: updates.description,
					content: updates.content,
					tags: updates.tags,
					format: updates.format,
					author: updates.author,
					updated_at: new Date().toISOString()
				})
				.eq("id", id)
				.select();

			if (error) throw error;

			this.prompts = this.prompts.map((p) => (p.id === id ? data[0] : p));
			this.renderPromptGrid();
			showNotification("Prompt updated successfully", "success");
		} catch (error) {
			console.error("Error updating prompt:", error);
			showNotification("Failed to update prompt", "error");
		}
	}

	async importFile(file) {
		try {
			const content = await file.text();
			const extension = file.name.split(".").pop().toLowerCase();
			let prompt;

			switch (extension) {
				case "json":
					prompt = this.parseJSON(content);
					break;
				case "md":
					prompt = this.parseMarkdown(content);
					break;
				case "xml":
					prompt = this.parseXML(content);
					break;
				case "txt":
					prompt = this.parsePlainText(content);
					break;
				default:
					throw new Error("Unsupported file format");
			}

			// Get metadata before saving
			const modal = document.createElement("div");
			modal.className =
				"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center";
			modal.innerHTML = `
				<div class="glass-effect rounded-xl p-6 m-4 max-w-md w-full animate-fade-in">
					<h3 class="text-xl font-semibold mb-4">Import Prompt Details</h3>
					<div class="space-y-4">
						<div>
							<label class="block mb-2">Title</label>
							<input type="text" id="prompt-title" class="w-full p-3 bg-surface rounded-lg border border-gray-700 focus:border-accent focus:ring-1 focus:ring-accent"
								value="${prompt.title || ""}" placeholder="Enter a title for your prompt">
						</div>
						<div>
							<label class="block mb-2">Description</label>
							<textarea id="prompt-description" rows="2" class="w-full p-3 bg-surface rounded-lg border border-gray-700 focus:border-accent focus:ring-1 focus:ring-accent"
								placeholder="Enter a description">${prompt.description || ""}</textarea>
						</div>
						<div>
							<label class="block mb-2">Tags (comma separated)</label>
							<input type="text" id="prompt-tags" class="w-full p-3 bg-surface rounded-lg border border-gray-700 focus:border-accent focus:ring-1 focus:ring-accent"
								value="${
									Array.isArray(prompt.tags) ? prompt.tags.join(", ") : ""
								}" placeholder="ai, chatgpt, etc">
						</div>
					</div>
					<div class="flex justify-end space-x-3 mt-6">
						<button id="cancel-import" class="px-4 py-2 bg-surface rounded-lg hover:bg-opacity-80 transition-all">Cancel</button>
						<button id="confirm-import" class="px-4 py-2 bg-accent rounded-lg hover:bg-opacity-80 transition-all">Import</button>
					</div>
				</div>
			`;

			document.body.appendChild(modal);

			return new Promise((resolve, reject) => {
				const closeModal = () => {
					modal.classList.add("animate-fade-out");
					setTimeout(() => document.body.removeChild(modal), 200);
				};

				modal.querySelector("#cancel-import").addEventListener("click", () => {
					closeModal();
					reject(new Error("Import cancelled"));
				});

				modal
					.querySelector("#confirm-import")
					.addEventListener("click", async () => {
						const saveButton = modal.querySelector("#confirm-import");
						const originalText = saveButton.innerHTML;

						try {
							saveButton.disabled = true;
							saveButton.innerHTML =
								'<i class="fas fa-spinner fa-spin mr-2"></i>Importing...';

							const title = modal.querySelector("#prompt-title").value.trim();
							const description = modal
								.querySelector("#prompt-description")
								.value.trim();
							const tags = modal
								.querySelector("#prompt-tags")
								.value.split(",")
								.map((tag) => tag.trim())
								.filter(Boolean);

							if (!title) {
								showNotification("Please enter a title", "error");
								return;
							}

							// Validate content length
							if (prompt.content.length > 10000) {
								showNotification(
									"Prompt content is too long (max 10000 characters)",
									"error"
								);
								return;
							}

							// Validate and clean tags
							const cleanedTags = tags.map((tag) =>
								tag.toLowerCase().replace(/[^a-z0-9-]/g, "-")
							);

							const authorName = await this.promptForAuthor();

							const promptData = {
								title,
								description: description || null,
								content: prompt.content,
								original_prompt: content, // Store the original file content
								tags: cleanedTags,
								format: prompt.format,
								author: authorName,
								updated_at: new Date().toISOString()
							};

							const savedPrompt = await this.savePrompt(promptData);
							showNotification(`Successfully imported ${file.name}`, "success");
							closeModal();
							resolve(savedPrompt);
						} catch (error) {
							console.error("Error during import:", error);
							showNotification(`Failed to import: ${error.message}`, "error");
							saveButton.disabled = false;
							saveButton.innerHTML = originalText;
							reject(error);
						}
					});
			});
		} catch (error) {
			console.error("Import error:", error);
			showNotification(
				`Failed to import ${file.name}: ${error.message}`,
				"error"
			);
			throw error;
		}
	}

	async promptForAuthor() {
		return new Promise((resolve, reject) => {
			const modal = document.createElement("div");
			modal.className =
				"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center";
			modal.innerHTML = `
				<div class="glass-effect rounded-xl p-6 m-4 max-w-md w-full animate-fade-in">
					<h3 class="text-xl font-semibold mb-4">Author Attribution</h3>
					<p class="text-sm text-gray-400 mb-4">Please enter your name to attribute this prompt to you. This helps the community track contributions and give credit where it's due.</p>
					<input type="text" id="author-input"
						class="w-full p-3 bg-surface rounded-lg border border-gray-700 focus:border-accent focus:ring-1 focus:ring-accent transition-all mb-4"
						placeholder="Your name"
						value="${localStorage.getItem("lastAuthor") || ""}">
					<div class="flex justify-end space-x-3">
						<button id="cancel-author" class="px-4 py-2 bg-surface rounded-lg hover:bg-opacity-80 transition-all">Cancel</button>
						<button id="save-author" class="px-4 py-2 bg-accent rounded-lg hover:bg-opacity-80 transition-all">Save</button>
					</div>
				</div>
			`;

			document.body.appendChild(modal);
			const input = modal.querySelector("#author-input");
			input.focus();

			const closeModal = (value = null) => {
				modal.classList.add("animate-fade-out");
				setTimeout(() => {
					document.body.removeChild(modal);
					if (value) {
						localStorage.setItem("lastAuthor", value);
						resolve(value);
					} else {
						reject(new Error("Author name is required"));
					}
				}, 200);
			};

			modal.querySelector("#save-author").addEventListener("click", () => {
				const value = input.value.trim();
				if (value) closeModal(value);
				else input.focus();
			});

			modal.querySelector("#cancel-author").addEventListener("click", () => {
				closeModal();
			});

			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
					const value = input.value.trim();
					if (value) closeModal(value);
				}
			});
		});
	}

	parseJSON(content) {
		// Check if content looks like XML despite .json extension
		if (content.trim().startsWith("<") && content.includes("</")) {
			return this.parseXML(content);
		}

		const data = JSON.parse(content);
		return {
			title: data.title || "Imported JSON Prompt",
			description: data.description || "",
			content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
			tags: data.tags || [],
			format: "json"
		};
	}

	parseMarkdown(content) {
		// Check if content looks like XML despite .md extension
		if (content.trim().startsWith("<") && content.includes("</")) {
			return this.parseXML(content);
		}

		const titleMatch = content.match(/^#\s+(.+)$/m);
		const descriptionMatch = content.match(/^>\s*(.+)$/m);
		const tagsMatch = content.match(/^Tags:\s*(.+)$/m);

		return {
			title: titleMatch ? titleMatch[1] : "Imported Markdown Prompt",
			description: descriptionMatch ? descriptionMatch[1] : "",
			content: content,
			tags: tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()) : [],
			format: "markdown"
		};
	}

	parseXML(content) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, "text/xml");

		// Check if it's actually XML by looking for parse errors
		const parseError = doc.querySelector("parsererror");
		if (parseError) {
			// If not valid XML, fall back to plain text
			return this.parsePlainText(content);
		}

		const prompt = doc.querySelector("prompt");
		const title =
			prompt?.querySelector("title")?.textContent ||
			doc.querySelector("title")?.textContent;

		return {
			title: title || "Imported XML Prompt",
			description: prompt?.querySelector("description")?.textContent || "",
			content: content,
			tags: Array.from(prompt?.querySelectorAll("tag") || []).map(
				(tag) => tag.textContent
			),
			format: "xml" // Always set format to xml for valid XML content
		};
	}

	parsePlainText(content) {
		// Check if content looks like XML
		if (content.trim().startsWith("<") && content.includes("</")) {
			return this.parseXML(content);
		}

		const lines = content.split("\n");
		const title = lines[0] || "Imported Text Prompt";
		const description = lines[1] || "";
		const remainingContent = lines.slice(2).join("\n");

		return {
			title,
			description,
			content: remainingContent || content,
			tags: [],
			format: "text"
		};
	}

	createPromptCard(prompt) {
		const fileTypeIcons = {
			json: "fa-code",
			markdown: "fa-markdown",
			xml: "fa-code",
			text: "fa-file-alt"
		};

		return `
			<div class="glass-effect rounded-xl p-6 card-hover">
				<div class="flex justify-between items-start mb-4">
					<div class="flex items-center gap-3">
						<i class="fas ${
							fileTypeIcons[prompt.format] || "fa-file"
						} text-accent cursor-pointer hover:scale-110 transition-all"
							onclick="library.sortByFormat('${prompt.format}')"
							title="Click to sort by ${prompt.format} files"></i>
						<h3 class="text-lg font-semibold">${prompt.title}</h3>
					</div>
					<div class="flex space-x-2">
						<button onclick="library.editPrompt(${
							prompt.id
						})" class="text-gray-400 hover:text-white">
							<i class="fas fa-edit"></i>
						</button>
						<button onclick="library.deletePrompt(${
							prompt.id
						})" class="text-gray-400 hover:text-white">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				</div>
				<p class="text-sm text-gray-400 mb-2">${prompt.description}</p>
				<p class="text-xs text-accent mb-4">Created by: ${prompt.author}</p>
				<div class="bg-surface rounded-lg p-3 mb-4 overflow-y-auto" style="max-height: 500px;">
					<pre class="text-xs whitespace-pre-wrap"><code>${prompt.content}</code></pre>
					${
						prompt.original_prompt
							? `
						<div class="mt-4 pt-4 border-t border-gray-700">
							<p class="text-xs text-gray-400 mb-2">Original Prompt:</p>
							<pre class="text-xs whitespace-pre-wrap"><code>${prompt.original_prompt}</code></pre>
						</div>
					`
							: ""
					}
				</div>
				<div class="flex flex-wrap gap-2">
					${prompt.tags
						.map(
							(tag) => `
						<span class="px-2 py-1 bg-surface rounded-full text-xs">
							${tag}
						</span>
					`
						)
						.join("")}
					<span class="px-2 py-1 bg-surface/50 rounded-full text-xs">Format: ${
						prompt.format
					}</span>
					<span class="px-2 py-1 bg-surface/50 rounded-full text-xs">Created: ${new Date(
						prompt.created_at
					).toLocaleDateString()}</span>
				</div>
			</div>
		`;
	}

	renderPromptGrid() {
		const grid = document.getElementById("prompt-grid");
		grid.innerHTML = this.prompts
			.map((prompt) => this.createPromptCard(prompt))
			.join("");
	}

	initializeEventListeners() {
		// Import button
		document.getElementById("import-file").addEventListener("click", () => {
			document.getElementById("file-input").click();
		});

		// File input change
		document
			.getElementById("file-input")
			.addEventListener("change", async (e) => {
				const files = Array.from(e.target.files);
				for (const file of files) {
					await this.importFile(file);
				}
				e.target.value = "";
			});

		// Create new prompt
		document.getElementById("create-prompt").addEventListener("click", () => {
			this.showModal();
		});

		// Modal controls
		document.getElementById("close-modal").addEventListener("click", () => {
			this.hideModal();
		});

		document.getElementById("cancel-prompt").addEventListener("click", () => {
			this.hideModal();
		});

		// Form submission
		document.getElementById("prompt-form").addEventListener("submit", (e) => {
			e.preventDefault();
			const formData = this.getFormData();
			if (formData.id) {
				this.updatePrompt(formData.id, formData);
			} else {
				this.addPrompt(formData);
			}
			this.hideModal();
		});

		// Search
		document.getElementById("search").addEventListener("input", (e) => {
			this.searchPrompts(e.target.value);
		});
	}

	showModal(prompt = null) {
		const modal = document.getElementById("prompt-modal");
		const form = document.getElementById("prompt-form");
		const title = document.querySelector("#prompt-modal h3");

		if (prompt) {
			title.textContent = "Edit Prompt";
			form.elements["prompt-title"].value = prompt.title;
			form.elements["prompt-description"].value = prompt.description;
			form.elements["prompt-content"].value = prompt.content;
			form.elements["prompt-author"].value = prompt.author;
			form.elements["prompt-tags"].value = prompt.tags.join(", ");
			form.dataset.id = prompt.id;
		} else {
			title.textContent = "Create New Prompt";
			form.reset();
			form.elements["prompt-author"].value =
				localStorage.getItem("lastAuthor") || "";
			delete form.dataset.id;
		}

		modal.classList.remove("hidden");
	}

	hideModal() {
		const modal = document.getElementById("prompt-modal");
		modal.classList.add("hidden");
	}

	getFormData() {
		const form = document.getElementById("prompt-form");
		return {
			id: form.dataset.id ? parseInt(form.dataset.id) : null,
			title: form.elements["prompt-title"].value,
			description: form.elements["prompt-description"].value,
			content: form.elements["prompt-content"].value,
			author: form.elements["prompt-author"].value,
			tags: form.elements["prompt-tags"].value
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			format: "text"
		};
	}

	editPrompt(id) {
		const prompt = this.prompts.find((p) => p.id === id);
		if (prompt) {
			this.showModal(prompt);
		}
	}

	searchPrompts(query) {
		const grid = document.getElementById("prompt-grid");
		const searchQuery = query.toLowerCase();

		const filteredPrompts = this.prompts.filter(
			(prompt) =>
				prompt.title.toLowerCase().includes(searchQuery) ||
				prompt.description.toLowerCase().includes(searchQuery) ||
				prompt.content.toLowerCase().includes(searchQuery) ||
				prompt.tags.some((tag) => tag.toLowerCase().includes(searchQuery))
		);

		grid.innerHTML = filteredPrompts
			.map((prompt) => this.createPromptCard(prompt))
			.join("");
	}

	sortByFormat(format) {
		this.prompts.sort((a, b) => {
			if (a.format === format && b.format !== format) return -1;
			if (a.format !== format && b.format === format) return 1;
			return 0;
		});
		this.renderPromptGrid();
		showNotification(`Sorted by ${format} format`, "success");
	}
}

// Initialize the library
const library = new PromptLibrary();
