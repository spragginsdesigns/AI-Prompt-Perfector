// Utility Functions
function encrypt(text) {
	return CryptoJS.AES.encrypt(text, "your-secret-key").toString();
}

function decrypt(ciphertext) {
	const bytes = CryptoJS.AES.decrypt(ciphertext, "your-secret-key");
	return bytes.toString(CryptoJS.enc.Utf8);
}

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

// Typewriter Animation
class TypewriterAnimation {
	constructor(
		element,
		phrases = [
			"Perfecting your prompt...",
			"Analyzing prompt structure...",
			"Enhancing clarity...",
			"Optimizing for AI..."
		]
	) {
		this.element = element;
		this.phrases = phrases;
		this.currentPhrase = 0;
		this.currentChar = 0;
		this.isDeleting = false;
		this.interval = null;
	}

	type() {
		const currentText = this.phrases[this.currentPhrase];

		if (this.isDeleting) {
			this.element.textContent = currentText.substring(0, this.currentChar - 1);
			this.currentChar--;
		} else {
			this.element.textContent = currentText.substring(0, this.currentChar + 1);
			this.currentChar++;
		}

		if (!this.isDeleting && this.currentChar === currentText.length) {
			setTimeout(() => (this.isDeleting = true), 1500);
		} else if (this.isDeleting && this.currentChar === 0) {
			this.isDeleting = false;
			this.currentPhrase = (this.currentPhrase + 1) % this.phrases.length;
		}
	}

	start() {
		this.interval = setInterval(() => this.type(), 100);
	}

	stop() {
		clearInterval(this.interval);
		this.element.textContent = "Completed!";
	}
}

// API Interaction
async function fetchApiKey() {
	try {
		const response = await fetch("/api-key");
		const data = await response.json();
		if (data.apiKey) {
			localStorage.setItem("openaiApiKey", encrypt(data.apiKey));
			showNotification("API key loaded successfully", "success");
		}
	} catch (error) {
		console.error("Failed to fetch API key:", error);
		showNotification("Failed to fetch API key", "error");
	}
}

function getApiKey() {
	const encryptedApiKey = localStorage.getItem("openaiApiKey");
	return encryptedApiKey ? decrypt(encryptedApiKey) : null;
}

async function callOpenAI(
	apiKey,
	prompt,
	systemPrompt,
	model = "gpt-4",
	maxTokens = 3000
) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt }
			],
			max_tokens: maxTokens
		})
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error?.message || "API request failed");
	}

	const data = await response.json();
	return data.choices[0].message.content;
}

// Multi-step LLM Processing
async function brainstormImprovements(apiKey, originalPrompt) {
	const systemPrompt = `You are an expert prompt analyst. Your task is to analyze the given prompt and provide specific suggestions for improvement. Focus on:
1. Identifying unclear or ambiguous elements
2. Suggesting additional context or constraints needed
3. Recommending structural improvements
4. Pointing out missing parameters or specifications
5. Suggesting ways to make the prompt more specific and effective

Provide your analysis in a structured format that can be used by another AI to implement these improvements.`;

	const userPrompt = `Analyze this prompt and suggest specific improvements:
${originalPrompt}

Provide your analysis in the following format:
{
  "clarity_issues": [...],
  "missing_context": [...],
  "structural_improvements": [...],
  "specificity_suggestions": [...],
  "format_recommendations": [...]
}`;

	return await callOpenAI(apiKey, userPrompt, systemPrompt);
}

async function implementImprovements(
	apiKey,
	originalPrompt,
	brainstormedImprovements,
	outputFormat
) {
	const systemPrompt = `You are an elite AI prompt engineer, specialized in crafting and refining prompts for optimal AI interaction. Use the provided analysis to transform the original prompt into a highly effective instruction set.

Your output must be in ${outputFormat} format.`;

	const userPrompt = `Original Prompt:
${originalPrompt}

Analysis and Suggestions:
${brainstormedImprovements}

Transform this prompt into a highly effective version, incorporating the suggested improvements.`;

	return await callOpenAI(apiKey, userPrompt, systemPrompt);
}

// Main Prompt Perfection Function
async function perfectPrompt() {
	const apiKey = getApiKey();
	const prompt = document.getElementById("prompt").value;
	const outputFormat = document.querySelector(
		'input[name="output-format"]:checked'
	).value;

	if (!apiKey || !prompt) {
		showNotification(
			!apiKey
				? "Please enter your OpenAI API key"
				: "Please enter a prompt to perfect",
			"error"
		);
		(!apiKey
			? document.getElementById("api-key")
			: document.getElementById("prompt")
		).focus();
		return;
	}

	const loader = document.getElementById("loader");
	const loadingText = document.getElementById("loading-text");
	const resultContainer = document.getElementById("result-container");
	const perfectPromptButton = document.getElementById("perfect-prompt");

	loader.classList.remove("hidden");
	resultContainer.classList.add("hidden");
	perfectPromptButton.disabled = true;
	perfectPromptButton.className =
		"w-full p-4 gradient-bg rounded-xl font-medium text-lg opacity-50 cursor-not-allowed";

	const typewriter = new TypewriterAnimation(loadingText);
	typewriter.start();

	try {
		// Step 1: Brainstorm improvements
		const improvements = await brainstormImprovements(apiKey, prompt);

		// Step 2: Implement improvements with specified format
		const perfectedPrompt = await implementImprovements(
			apiKey,
			prompt,
			improvements,
			outputFormat
		);

		typewriter.stop();
		document.getElementById("result").textContent = perfectedPrompt;
		resultContainer.classList.remove("hidden");
		showNotification("Prompt perfected successfully!", "success");
	} catch (error) {
		console.error("Error:", error);
		document.getElementById(
			"result"
		).textContent = `An error occurred: ${error.message}. Please check your API key and try again.`;
		resultContainer.classList.remove("hidden");
		showNotification("Failed to perfect prompt. Please try again.", "error");
	} finally {
		loader.classList.add("hidden");
		perfectPromptButton.disabled = false;
		perfectPromptButton.className =
			"w-full p-4 gradient-bg rounded-xl font-medium text-lg hover:opacity-90 transition-all focus:ring-2 focus:ring-accent focus:ring-opacity-50";
	}
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
	const apiKeyInput = document.getElementById("api-key");
	const savedKey = getApiKey();
	if (savedKey) {
		apiKeyInput.value = savedKey;
		showNotification("API key loaded from storage", "success");
	} else {
		fetchApiKey();
	}

	// Add input animations
	const inputs = document.querySelectorAll("input, textarea");
	inputs.forEach((input) => {
		input.addEventListener("focus", () => {
			input.parentElement.classList.add("scale-[1.02]");
		});
		input.addEventListener("blur", () => {
			input.parentElement.classList.remove("scale-[1.02]");
		});
	});

	// Event listeners for buttons
	document.getElementById("save-key").addEventListener("click", () => {
		const apiKeyInput = document.getElementById("api-key");
		if (apiKeyInput.value.trim() === "") {
			showNotification("Please enter a valid API key", "error");
			apiKeyInput.focus();
		} else {
			localStorage.setItem("openaiApiKey", encrypt(apiKeyInput.value));
			showNotification("API key saved successfully!", "success");
		}
	});

	const promptInput = document.getElementById("prompt");
	const charCount = document.getElementById("char-count");

	promptInput.addEventListener("input", () => {
		const count = promptInput.value.length;
		charCount.textContent = `${count} characters`;
		charCount.className = "text-sm text-gray-400";
	});

	document.getElementById("clear-prompt").addEventListener("click", () => {
		promptInput.value = "";
		charCount.textContent = "0 characters";
		charCount.className = "text-sm text-gray-400";
		promptInput.focus();
	});

	document
		.getElementById("perfect-prompt")
		.addEventListener("click", perfectPrompt);
	document
		.getElementById("regenerate-prompt")
		.addEventListener("click", perfectPrompt);

	document.getElementById("copy-result").addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(
				document.getElementById("result").textContent
			);
			showNotification("Perfected prompt copied to clipboard!", "success");
		} catch (err) {
			console.error("Failed to copy text: ", err);
			showNotification("Failed to copy text. Please try again.", "error");
		}
	});
});
