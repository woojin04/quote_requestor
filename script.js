const form = document.getElementById("quote-form");
const response = document.getElementById("form-response");
const photoInput = document.getElementById("photo-input");
const photoDropzone = document.getElementById("photo-dropzone");
const fileHelp = document.getElementById("file-help");
const submitButton = document.getElementById("submit-button");

let selectedFiles = [];

photoInput.addEventListener("change", () => {
  mergeSelectedFiles(photoInput.files);
});

photoDropzone.addEventListener("click", () => {
  photoInput.click();
});

photoDropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    photoInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  photoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    photoDropzone.classList.add("is-dragover");
  });
});

["dragleave", "dragend", "drop"].forEach((eventName) => {
  photoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    photoDropzone.classList.remove("is-dragover");
  });
});

photoDropzone.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;

  if (!files || files.length === 0) {
    return;
  }

  mergeSelectedFiles(files);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  response.textContent = "메일을 전송하는 중입니다...";
  submitButton.disabled = true;

  try {
    syncPhotoInput();

    const formData = new FormData(form);
    const request = await fetch("/api/request", {
      method: "POST",
      body: formData,
    });

    const result = await parseJsonResponse(request);

    if (!request.ok) {
      throw new Error(formatResponseMessage(result, `요청 전송에 실패했습니다. (HTTP ${request.status})`));
    }

    response.textContent = formatResponseMessage(result, "메일 전송이 완료되었습니다.");
    form.reset();
    selectedFiles = [];
    syncFileHelp();
  } catch (error) {
    response.textContent = error.message || "오류가 발생했습니다.";
  } finally {
    submitButton.disabled = false;
  }
});

function mergeSelectedFiles(fileList) {
  const incomingFiles = Array.from(fileList || []);

  if (incomingFiles.length === 0) {
    syncFileHelp();
    return;
  }

  for (const file of incomingFiles) {
    const duplicate = selectedFiles.some((existingFile) => isSameFile(existingFile, file));

    if (!duplicate) {
      selectedFiles.push(file);
    }
  }

  syncPhotoInput();
  syncFileHelp();
}

function syncPhotoInput() {
  const dataTransfer = new DataTransfer();

  for (const file of selectedFiles) {
    dataTransfer.items.add(file);
  }

  photoInput.files = dataTransfer.files;
}

function syncFileHelp() {
  if (selectedFiles.length === 0) {
    fileHelp.textContent = "여러 장 선택할 수 있습니다.";
    photoDropzone.classList.remove("has-files");
    return;
  }

  const fileNames = selectedFiles.map((file) => file.name).join(", ");
  fileHelp.textContent = `${selectedFiles.length}개 선택됨: ${fileNames}`;
  photoDropzone.classList.add("has-files");
}

function isSameFile(left, right) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified &&
    left.type === right.type
  );
}

function formatResponseMessage(result, fallbackMessage) {
  const lines = [result.message || result.error || fallbackMessage];

  if (result.env) {
    lines.push(
      `RESEND_API_KEY loaded: ${result.env.resendApiKeyPresent ? "YES" : "NO"}`,
      `RESEND_API_KEY masked: ${result.env.resendApiKeyMasked || "null"}`,
      `EMAIL_FROM loaded: ${result.env.emailFromPresent ? "YES" : "NO"}`,
      `EMAIL_FROM masked: ${result.env.emailFromMasked || "null"}`,
      `RESEND_FROM_EMAIL loaded: ${result.env.resendFromEmailPresent ? "YES" : "NO"}`,
      `RESEND_FROM_EMAIL masked: ${result.env.resendFromEmailMasked || "null"}`,
      `Effective sender masked: ${result.env.effectiveFromEmailMasked || "null"}`,
      `RESEND_TO_EMAIL loaded: ${result.env.resendToEmailPresent ? "YES" : "NO"}`,
      `RESEND_TO_EMAIL masked: ${result.env.resendToEmailMasked || "null"}`,
    );
  }

  return lines.join("\n");
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      return {
        error: `서버가 JSON이 아닌 응답을 반환했습니다. (HTTP ${response.status})`,
      };
    }

    throw new Error("서버 응답을 해석하지 못했습니다.");
  }
}
