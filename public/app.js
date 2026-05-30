const form = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt");
const generateButton = document.querySelector("#generate-button");
const responseOutput = document.querySelector("#response-output");
const statusText = document.querySelector("#status-text");
const charCount = document.querySelector("#char-count");

function updateCharacterCount() {
  charCount.textContent = `${promptInput.value.length} / ${promptInput.maxLength}`;
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.textContent = isLoading ? "Generating..." : "Generate";
  statusText.textContent = isLoading ? "Working" : "Ready";
}

function showResponse(text) {
  responseOutput.classList.remove("error");
  responseOutput.textContent = text;
}

function showError(message) {
  responseOutput.classList.add("error");
  responseOutput.textContent = message;
  statusText.textContent = "Error";
}

promptInput.addEventListener("input", updateCharacterCount);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    showError("Enter a prompt before generating a response.");
    return;
  }

  setLoading(true);
  showResponse("Generating response...");

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    showResponse(data.response);
  } catch (error) {
    showError(error.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
});

updateCharacterCount();
