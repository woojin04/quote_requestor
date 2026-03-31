const form = document.getElementById("quote-form");
const response = document.getElementById("form-response");
const photoInput = document.getElementById("photo-input");
const fileHelp = document.getElementById("file-help");
const submitButton = document.getElementById("submit-button");

photoInput.addEventListener("change", () => {
  const files = Array.from(photoInput.files || []);

  if (files.length === 0) {
    fileHelp.textContent = "여러 장 선택할 수 있습니다.";
    return;
  }

  const fileNames = files.map((file) => file.name).join(", ");
  fileHelp.textContent = `${files.length}장 선택됨: ${fileNames}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  response.textContent = "메일을 전송하는 중입니다...";
  submitButton.disabled = true;

  try {
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
    fileHelp.textContent = "여러 장 선택할 수 있습니다.";
  } catch (error) {
    response.textContent = error.message || "오류가 발생했습니다.";
  } finally {
    submitButton.disabled = false;
  }
});

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
